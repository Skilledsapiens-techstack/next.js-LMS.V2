import { User } from '@supabase/supabase-js';
import { StudentScheduleService } from './student-schedule.service';

type RpcResult = { data: unknown; error: { message: string } | null };

class MockSupabase {
  rpcResult: RpcResult = { data: [], error: null };
  rpcCalls: Array<{ functionName: string; params: Record<string, string>; accessToken: string }> = [];

  forUser(accessToken: string) {
    return {
      rpc: (functionName: string, params: Record<string, string>) => {
        this.rpcCalls.push({ functionName, params, accessToken });
        return Promise.resolve(this.rpcResult);
      }
    };
  }
}

class MockStudentsService {
  getCurrentStudent = jest.fn().mockResolvedValue({
    id: 'student-uuid',
    fullName: 'Student One',
    email: ' Student@Example.com ',
    trackRoleIds: [],
    active: true
  });
}

function createUser(): User {
  return {
    id: 'auth-user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date('2026-06-27T00:00:00.000Z').toISOString(),
    email: 'student@example.com'
  };
}

describe('StudentScheduleService', () => {
  let supabase: MockSupabase;
  let studentsService: MockStudentsService;
  let service: StudentScheduleService;

  beforeEach(() => {
    supabase = new MockSupabase();
    studentsService = new MockStudentsService();
    service = new StudentScheduleService(supabase as never, studentsService as never);
  });

  it('lists upcoming schedule through the student-scoped RPC without exposing locked join links', async () => {
    supabase.rpcResult = {
      data: [
        {
          id: 'workshop-row-1',
          workshop_id: 'WS-001',
          title: 'Live Strategy Session',
          date: '2026-07-01',
          time: '18:00',
          duration_minutes: '90',
          program_key: 'mba',
          domain_key: 'strategy',
          cohort_names: ['MBA June'],
          workshop_status: 'Upcoming',
          join_url: 'https://zoom.example/private',
          access_type: 'paid',
          hasAccess: false,
          locked: true,
          lockReason: 'Payment required',
          price: '999',
          currency: 'INR',
          zoom_start_url: 'should-not-be-selected'
        }
      ],
      error: null
    };

    const result = await service.listMySchedule(createUser(), 'student-token', { page: 1, limit: 25, accessType: 'all', status: 'all' });

    expect(result.items[0]).toEqual({
      id: 'workshop-row-1',
      workshopId: 'WS-001',
      title: 'Live Strategy Session',
      date: '2026-07-01',
      time: '18:00',
      durationMinutes: 90,
      programKey: 'mba',
      domainKey: 'strategy',
      cohortNames: ['MBA June'],
      status: 'Upcoming',
      accessType: 'paid',
      hasAccess: false,
      locked: true,
      lockReason: 'Payment required',
      price: 999,
      currency: 'INR'
    });
    expect(result.items[0]).not.toHaveProperty('joinUrl');
    expect(result.items[0]).not.toHaveProperty('zoomStartUrl');
    expect(supabase.rpcCalls).toEqual([
      {
        functionName: 'student_schedule_view',
        params: { p_student_email: 'student@example.com' },
        accessToken: 'student-token'
      }
    ]);
  });

  it('applies status, access type, search, and pagination filters after RPC visibility is resolved', async () => {
    supabase.rpcResult = {
      data: {
        schedule: [
          {
            id: 'workshop-1',
            workshop_id: 'WS-001',
            title: 'Finance Sprint',
            date: '2026-07-01',
            time: '18:00',
            duration_minutes: 60,
            program_key: 'mba',
            domain_key: 'finance',
            cohort_names: ['MBA June'],
            workshop_status: 'Upcoming',
            join_url: 'https://zoom.example/1',
            access_type: 'free',
            hasAccess: true,
            locked: false,
            lockReason: '',
            price: null,
            currency: null
          },
          {
            id: 'workshop-2',
            workshop_id: 'WS-002',
            title: 'Finance Review',
            date: '2026-07-02',
            time: '18:00',
            duration_minutes: 60,
            program_key: 'mba',
            domain_key: 'finance',
            cohort_names: ['MBA June'],
            workshop_status: 'Upcoming',
            join_url: 'https://zoom.example/2',
            access_type: 'free',
            hasAccess: true,
            locked: false,
            lockReason: '',
            price: null,
            currency: null
          },
          {
            id: 'workshop-3',
            workshop_id: 'WS-003',
            title: 'Paid Strategy',
            date: '2026-07-03',
            time: '18:00',
            duration_minutes: 60,
            program_key: 'mba',
            domain_key: 'strategy',
            cohort_names: ['MBA June'],
            workshop_status: 'Upcoming',
            join_url: 'https://zoom.example/3',
            access_type: 'paid',
            hasAccess: true,
            locked: false,
            lockReason: '',
            price: null,
            currency: null
          }
        ]
      },
      error: null
    };

    const result = await service.listMySchedule(createUser(), 'student-token', {
      page: 2,
      limit: 1,
      accessType: 'free',
      status: 'Upcoming',
      search: ' finance '
    });

    expect(result.items.map((item) => item.id)).toEqual(['workshop-2']);
    expect(result.items[0].joinUrl).toBe('https://zoom.example/2');
    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.hasPreviousPage).toBe(true);
    expect(result.hasNextPage).toBe(false);
  });
});
