import { User } from '@supabase/supabase-js';
import { StudentAnnouncementsService } from './student-announcements.service';

type RpcResult = { data: unknown; error: { message: string } | null };

class MockSupabase {
  rpcResult: RpcResult = { data: { announcements: [] }, error: null };
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

describe('StudentAnnouncementsService', () => {
  let supabase: MockSupabase;
  let studentsService: MockStudentsService;
  let service: StudentAnnouncementsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    studentsService = new MockStudentsService();
    service = new StudentAnnouncementsService(supabase as never, studentsService as never);
  });

  it('lists student-scoped announcements from the dashboard bundle with a stable response shape', async () => {
    supabase.rpcResult = {
      data: {
        announcements: [
          {
            id: 'announcement-row-1',
            announcement_id: 'ANN-001',
            type: 'general',
            title: 'Live class update',
            message: 'Your class link is updated.',
            audience: 'cohort',
            program_keys: ['mba'],
            cohort_names: ['MBA June'],
            priority: 'urgent',
            pinned: true,
            start_date: '2026-06-27',
            end_date: '2026-07-01',
            link_label: 'Open LMS',
            link_url: 'https://example.com/lms',
            status: 'active',
            internal_notes: 'should-not-be-selected',
            updated_at: '2026-06-27T00:00:00.000Z'
          }
        ]
      },
      error: null
    };

    const result = await service.listMyAnnouncements(createUser(), 'student-token', { page: 1, limit: 25, priority: 'all' });

    expect(result.items).toEqual([
      {
        id: 'announcement-row-1',
        announcementId: 'ANN-001',
        type: 'general',
        title: 'Live class update',
        message: 'Your class link is updated.',
        audience: 'cohort',
        programKeys: ['mba'],
        cohortNames: ['MBA June'],
        priority: 'urgent',
        pinned: true,
        startDate: '2026-06-27',
        endDate: '2026-07-01',
        linkLabel: 'Open LMS',
        linkUrl: 'https://example.com/lms',
        updatedAt: '2026-06-27T00:00:00.000Z'
      }
    ]);
    expect(result.items[0]).not.toHaveProperty('internalNotes');
    expect(result.items[0]).not.toHaveProperty('status');
    expect(supabase.rpcCalls).toEqual([
      {
        functionName: 'student_dashboard_bundle',
        params: { p_student_email: 'student@example.com' },
        accessToken: 'student-token'
      }
    ]);
  });

  it('supports older programs/cohorts field names and applies priority, search, and pagination filters', async () => {
    supabase.rpcResult = {
      data: {
        announcements: [
          {
            id: 'announcement-1',
            title: 'Finance update',
            message: 'Finance class moved.',
            programs: ['mba'],
            cohorts: ['MBA June'],
            priority: 'important',
            pinned: false
          },
          {
            id: 'announcement-2',
            title: 'Finance reminder',
            message: 'Submit finance prework.',
            programs: ['mba'],
            cohorts: ['MBA June'],
            priority: 'important',
            pinned: false
          },
          {
            id: 'announcement-3',
            title: 'General note',
            message: 'Portal maintenance.',
            programs: [],
            cohorts: [],
            priority: 'normal',
            pinned: false
          }
        ]
      },
      error: null
    };

    const result = await service.listMyAnnouncements(createUser(), 'student-token', {
      page: 2,
      limit: 1,
      priority: 'important',
      search: ' finance '
    });

    expect(result.items.map((item) => item.id)).toEqual(['announcement-2']);
    expect(result.items[0].programKeys).toEqual(['mba']);
    expect(result.items[0].cohortNames).toEqual(['MBA June']);
    expect(result.total).toBe(2);
    expect(result.hasPreviousPage).toBe(true);
    expect(result.hasNextPage).toBe(false);
  });
});
