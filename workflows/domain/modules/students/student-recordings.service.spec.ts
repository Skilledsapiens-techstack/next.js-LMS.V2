import { User } from '@supabase/supabase-js';
import { StudentRecordingsService } from './student-recordings.service';

type RpcResult = { data: unknown; error: { message: string } | null };

class MockSupabase {
  rpcResult: RpcResult = { data: { workshops: [] }, error: null };
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

describe('StudentRecordingsService', () => {
  let supabase: MockSupabase;
  let studentsService: MockStudentsService;
  let service: StudentRecordingsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    studentsService = new MockStudentsService();
    service = new StudentRecordingsService(supabase as never, studentsService as never);
  });

  it('lists completed published recordings from the student-scoped dashboard bundle', async () => {
    supabase.rpcResult = {
      data: {
        workshops: [
          {
            id: 'workshop-row-1',
            workshop_id: 'WS-001',
            title: 'Completed Strategy Session',
            date: '2026-06-01',
            time: '18:00',
            duration_minutes: '90',
            program_key: 'mba',
            domain_key: 'strategy',
            cohort_names: ['MBA June'],
            workshop_status: 'Completed',
            youtube_video_url: 'https://youtube.example/watch',
            zoom_recording_url: 'https://zoom.example/recording',
            access_type: 'free',
            hasAccess: true,
            locked: false,
            lockReason: '',
            price: null,
            currency: null,
            zoom_start_url: 'should-not-be-selected'
          },
          {
            id: 'workshop-row-2',
            workshop_id: 'WS-002',
            title: 'Upcoming Session',
            date: '2026-07-01',
            time: '18:00',
            duration_minutes: 90,
            program_key: 'mba',
            domain_key: 'strategy',
            cohort_names: ['MBA June'],
            workshop_status: 'Upcoming',
            youtube_video_url: 'https://youtube.example/future',
            zoom_recording_url: null,
            access_type: 'free',
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

    const result = await service.listMyRecordings(createUser(), 'student-token', { page: 1, limit: 25, accessType: 'all', source: 'all' });

    expect(result.items).toEqual([
      {
        id: 'workshop-row-1',
        workshopId: 'WS-001',
        title: 'Completed Strategy Session',
        date: '2026-06-01',
        time: '18:00',
        durationMinutes: 90,
        programKey: 'mba',
        domainKey: 'strategy',
        cohortNames: ['MBA June'],
        accessType: 'free',
        hasAccess: true,
        locked: false,
        source: 'youtube',
        recordingUrl: 'https://youtube.example/watch'
      }
    ]);
    expect(result.items[0]).not.toHaveProperty('zoomStartUrl');
    expect(supabase.rpcCalls).toEqual([
      {
        functionName: 'student_dashboard_bundle',
        params: { p_student_email: 'student@example.com' },
        accessToken: 'student-token'
      }
    ]);
  });

  it('omits recording URLs for locked paid recordings while preserving lock metadata', async () => {
    supabase.rpcResult = {
      data: {
        workshops: [
          {
            id: 'workshop-row-1',
            workshop_id: 'WS-001',
            title: 'Premium Recording',
            date: '2026-06-01',
            time: null,
            duration_minutes: null,
            program_key: 'mba',
            domain_key: null,
            cohort_names: ['MBA June'],
            workshop_status: 'Completed',
            youtube_video_url: '',
            zoom_recording_url: 'https://zoom.example/private-recording',
            access_type: 'paid',
            hasAccess: false,
            locked: true,
            lockReason: 'Payment required',
            price: '999',
            currency: 'INR'
          }
        ]
      },
      error: null
    };

    const result = await service.listMyRecordings(createUser(), 'student-token', { page: 1, limit: 25, accessType: 'all', source: 'all' });

    expect(result.items[0]).toEqual({
      id: 'workshop-row-1',
      workshopId: 'WS-001',
      title: 'Premium Recording',
      date: '2026-06-01',
      programKey: 'mba',
      cohortNames: ['MBA June'],
      accessType: 'paid',
      hasAccess: false,
      locked: true,
      lockReason: 'Payment required',
      source: 'zoom',
      price: 999,
      currency: 'INR'
    });
    expect(result.items[0]).not.toHaveProperty('recordingUrl');
  });

  it('applies source, access type, search, and pagination filters after visibility is resolved', async () => {
    supabase.rpcResult = {
      data: {
        workshops: [
          {
            id: 'recording-1',
            workshop_id: 'WS-001',
            title: 'Finance Deep Dive',
            date: '2026-06-01',
            time: '18:00',
            duration_minutes: 60,
            program_key: 'mba',
            domain_key: 'finance',
            cohort_names: ['MBA June'],
            workshop_status: 'Completed',
            youtube_video_url: 'https://youtube.example/1',
            zoom_recording_url: null,
            access_type: 'free',
            hasAccess: true,
            locked: false,
            lockReason: '',
            price: null,
            currency: null
          },
          {
            id: 'recording-2',
            workshop_id: 'WS-002',
            title: 'Finance Review',
            date: '2026-06-02',
            time: '18:00',
            duration_minutes: 60,
            program_key: 'mba',
            domain_key: 'finance',
            cohort_names: ['MBA June'],
            workshop_status: 'Completed',
            youtube_video_url: 'https://youtube.example/2',
            zoom_recording_url: null,
            access_type: 'free',
            hasAccess: true,
            locked: false,
            lockReason: '',
            price: null,
            currency: null
          },
          {
            id: 'recording-3',
            workshop_id: 'WS-003',
            title: 'Paid Zoom Session',
            date: '2026-06-03',
            time: '18:00',
            duration_minutes: 60,
            program_key: 'mba',
            domain_key: 'strategy',
            cohort_names: ['MBA June'],
            workshop_status: 'Completed',
            youtube_video_url: null,
            zoom_recording_url: 'https://zoom.example/3',
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

    const result = await service.listMyRecordings(createUser(), 'student-token', {
      page: 2,
      limit: 1,
      accessType: 'free',
      source: 'youtube',
      search: ' finance '
    });

    expect(result.items.map((item) => item.id)).toEqual(['recording-2']);
    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.hasPreviousPage).toBe(true);
    expect(result.hasNextPage).toBe(false);
  });
});
