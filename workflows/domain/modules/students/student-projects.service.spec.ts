import { User } from '@supabase/supabase-js';
import { StudentProjectsService } from './student-projects.service';

type RpcResult = { data: unknown; error: { message: string } | null };

class MockSupabase {
  rpcResult: RpcResult = { data: { projects: [] }, error: null };
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

describe('StudentProjectsService', () => {
  let supabase: MockSupabase;
  let studentsService: MockStudentsService;
  let service: StudentProjectsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    studentsService = new MockStudentsService();
    service = new StudentProjectsService(supabase as never, studentsService as never);
  });

  it('lists visible projects from the student-scoped projects bundle with parsed content', async () => {
    supabase.rpcResult = {
      data: {
        projects: [
          {
            project_id: 'PROJ-001',
            role_id: 'role-1',
            project_role: 'Consultant',
            company_name: 'Acme',
            program_key: 'mclp',
            program_keys: ['mclp'],
            program_name: 'Management Consulting',
            title: 'Market Entry Case',
            brief: 'Build a market entry recommendation.',
            objectives: 'Practice structured thinking.',
            action_items: 'Research: Gather market facts;;Model: Estimate market size',
            deliverables: 'Deck|PPTX|Final recommendation',
            resources: 'Template|https://example.com/template|deck|Starter file',
            submission_link: 'https://forms.example/submit',
            deadline: '2026-07-15',
            status: 'active',
            internal_notes: 'should-not-be-selected',
            updated_at: '2026-06-27T00:00:00.000Z'
          }
        ]
      },
      error: null
    };

    const result = await service.listMyProjects(createUser(), 'student-token', { page: 1, limit: 25 });

    expect(result.items[0]).toEqual({
      id: 'PROJ-001',
      roleId: 'role-1',
      projectRole: 'Consultant',
      companyName: 'Acme',
      programKey: 'mclp',
      programKeys: ['mclp'],
      programName: 'Management Consulting',
      title: 'Market Entry Case',
      brief: 'Build a market entry recommendation.',
      objectives: 'Practice structured thinking.',
      tasks: [
        { title: 'Research', description: 'Gather market facts' },
        { title: 'Model', description: 'Estimate market size' }
      ],
      documents: [{ title: 'Template', link: 'https://example.com/template', type: 'deck', description: 'Starter file' }],
      deliverables: [{ title: 'Deck', format: 'PPTX', note: 'Final recommendation' }],
      submissionLink: 'https://forms.example/submit',
      deadline: '2026-07-15',
      updatedAt: '2026-06-27T00:00:00.000Z'
    });
    expect(result.items[0]).not.toHaveProperty('internalNotes');
    expect(supabase.rpcCalls).toEqual([
      {
        functionName: 'student_projects_bundle',
        params: { p_student_email: 'student@example.com' },
        accessToken: 'student-token'
      }
    ]);
  });

  it('applies role, program, search, and pagination filters after visibility is resolved', async () => {
    supabase.rpcResult = {
      data: {
        projects: [
          {
            project_id: 'PROJ-001',
            role_id: 'role-1',
            project_role: 'Consultant',
            company_name: 'Acme',
            program_key: 'mclp',
            program_keys: ['mclp'],
            program_name: 'Management Consulting',
            title: 'Finance Case',
            brief: null,
            objectives: null,
            action_items: [],
            deliverables: [],
            resources: [],
            submission_link: null,
            deadline: null,
            updated_at: null
          },
          {
            project_id: 'PROJ-002',
            role_id: 'role-1',
            project_role: 'Consultant',
            company_name: 'Acme',
            program_key: 'mclp',
            program_keys: ['mclp'],
            program_name: 'Management Consulting',
            title: 'Finance Review',
            brief: null,
            objectives: null,
            action_items: [],
            deliverables: [],
            resources: [],
            submission_link: null,
            deadline: null,
            updated_at: null
          },
          {
            project_id: 'PROJ-003',
            role_id: 'role-2',
            project_role: 'Analyst',
            company_name: 'Beta',
            program_key: 'mba',
            program_keys: ['mba'],
            program_name: 'MBA',
            title: 'Strategy Case',
            brief: null,
            objectives: null,
            action_items: [],
            deliverables: [],
            resources: [],
            submission_link: null,
            deadline: null,
            updated_at: null
          }
        ]
      },
      error: null
    };

    const result = await service.listMyProjects(createUser(), 'student-token', {
      page: 2,
      limit: 1,
      roleId: 'role-1',
      programKey: 'mclp',
      search: ' finance '
    });

    expect(result.items.map((item) => item.id)).toEqual(['PROJ-002']);
    expect(result.total).toBe(2);
    expect(result.hasPreviousPage).toBe(true);
    expect(result.hasNextPage).toBe(false);
  });
});
