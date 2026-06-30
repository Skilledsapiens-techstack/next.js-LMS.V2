import { User } from '@supabase/supabase-js';
import { StudentCohortsService } from './student-cohorts.service';

type RpcResult = { data: unknown; error: { message: string } | null };

class MockSupabase {
  rpcResult: RpcResult = { data: { cohorts: [] }, error: null };
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

describe('StudentCohortsService', () => {
  let supabase: MockSupabase;
  let studentsService: MockStudentsService;
  let service: StudentCohortsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    studentsService = new MockStudentsService();
    service = new StudentCohortsService(supabase as never, studentsService as never);
  });

  it('lists visible cohorts from the student-scoped dashboard bundle with a safe response shape', async () => {
    supabase.rpcResult = {
      data: {
        cohorts: [
          {
            id: 'cohort-row-1',
            cohort_id: 'COH-001',
            name: 'MBA June',
            program_key: 'mba',
            domain_key: 'finance',
            status: 'active',
            start_date: '2026-06-01',
            end_date: '2026-08-01',
            wa_group_name: 'MBA June WA',
            wa_link: 'https://chat.example/mba-june',
            student_count: '42',
            self_paced: true,
            google_group: 'should-not-be-selected',
            updated_at: '2026-06-27T00:00:00.000Z'
          }
        ]
      },
      error: null
    };

    const result = await service.listMyCohorts(createUser(), 'student-token', { page: 1, limit: 25, status: 'all' });

    expect(result.items).toEqual([
      {
        id: 'cohort-row-1',
        cohortId: 'COH-001',
        name: 'MBA June',
        programKey: 'mba',
        domainKey: 'finance',
        status: 'active',
        startDate: '2026-06-01',
        endDate: '2026-08-01',
        whatsappGroupName: 'MBA June WA',
        whatsappLink: 'https://chat.example/mba-june',
        studentCount: 42,
        selfPaced: true,
        updatedAt: '2026-06-27T00:00:00.000Z'
      }
    ]);
    expect(result.items[0]).not.toHaveProperty('googleGroup');
    expect(supabase.rpcCalls).toEqual([
      {
        functionName: 'student_dashboard_bundle',
        params: { p_student_email: 'student@example.com' },
        accessToken: 'student-token'
      }
    ]);
  });

  it('applies status, search, and pagination filters after visibility is resolved', async () => {
    supabase.rpcResult = {
      data: {
        cohorts: [
          {
            id: 'cohort-1',
            name: 'Finance June',
            program_key: 'mba',
            domain_key: 'finance',
            status: 'active',
            self_paced: false
          },
          {
            id: 'cohort-2',
            name: 'Finance July',
            program_key: 'mba',
            domain_key: 'finance',
            status: 'active',
            self_paced: false
          },
          {
            id: 'cohort-3',
            name: 'Strategy July',
            program_key: 'mba',
            domain_key: 'strategy',
            status: 'upcoming',
            self_paced: false
          }
        ]
      },
      error: null
    };

    const result = await service.listMyCohorts(createUser(), 'student-token', {
      page: 2,
      limit: 1,
      status: 'active',
      search: ' finance '
    });

    expect(result.items.map((item) => item.id)).toEqual(['cohort-2']);
    expect(result.total).toBe(2);
    expect(result.hasPreviousPage).toBe(true);
    expect(result.hasNextPage).toBe(false);
  });
});
