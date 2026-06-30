import { User } from '@supabase/supabase-js';
import { StudentResourcesService } from './student-resources.service';

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
    created_at: new Date('2026-06-26T00:00:00.000Z').toISOString(),
    email: 'student@example.com'
  };
}

describe('StudentResourcesService', () => {
  let supabase: MockSupabase;
  let studentsService: MockStudentsService;
  let service: StudentResourcesService;

  beforeEach(() => {
    supabase = new MockSupabase();
    studentsService = new MockStudentsService();
    service = new StudentResourcesService(supabase as never, studentsService as never);
  });

  it('lists visible resources through the student-scoped RPC with bounded pagination', async () => {
    supabase.rpcResult = {
      data: [
        {
          id: 'resource-row-1',
          resource_id: 'RES-001',
          title: 'Premium Toolkit',
          description: 'Templates and notes',
          resource_type: 'template',
          resource_mode: 'pdf',
          phase: 'phase1',
          program_keys: ['mba'],
          cohort_names: ['MBA June'],
          url: null,
          access_type: 'paid',
          hasAccess: false,
          locked: true,
          lockReason: 'Payment required',
          price: '999',
          currency: 'INR',
          updated_at: '2026-06-26T00:00:00.000Z',
          internal_notes: 'should-not-be-selected'
        }
      ],
      error: null
    };

    const result = await service.listMyResources(createUser(), 'student-token', { page: 1, limit: 25, accessType: 'all' });

    expect(result.items[0]).toEqual({
      id: 'resource-row-1',
      resourceId: 'RES-001',
      title: 'Premium Toolkit',
      description: 'Templates and notes',
      resourceType: 'template',
      resourceMode: 'pdf',
      phase: 'phase1',
      programKeys: ['mba'],
      cohortNames: ['MBA June'],
      accessType: 'paid',
      hasAccess: false,
      locked: true,
      lockReason: 'Payment required',
      price: 999,
      currency: 'INR',
      updatedAt: '2026-06-26T00:00:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).not.toHaveProperty('internalNotes');
    expect(supabase.rpcCalls).toEqual([
      {
        functionName: 'student_resources_view',
        params: { p_student_email: 'student@example.com' },
        accessToken: 'student-token'
      }
    ]);
  });

  it('applies access type, resource type, search, and pagination filters after visibility is resolved', async () => {
    supabase.rpcResult = {
      data: {
        resources: [
          {
            id: 'resource-1',
            resource_id: 'RES-001',
            title: 'First Toolkit',
            description: 'Finance notes',
            resource_type: 'template',
            resource_mode: 'pdf',
            phase: null,
            program_keys: ['mba'],
            cohort_names: ['MBA June'],
            url: 'https://example.com/1',
            access_type: 'free',
            hasAccess: true,
            locked: false,
            lockReason: '',
            price: null,
            currency: null,
            updated_at: null
          },
          {
            id: 'resource-2',
            resource_id: 'RES-002',
            title: 'Second Toolkit',
            description: 'Finance notes',
            resource_type: 'template',
            resource_mode: 'pdf',
            phase: null,
            program_keys: ['mba'],
            cohort_names: ['MBA June'],
            url: 'https://example.com/2',
            access_type: 'free',
            hasAccess: true,
            locked: false,
            lockReason: '',
            price: null,
            currency: null,
            updated_at: null
          },
          {
            id: 'resource-3',
            resource_id: 'RES-003',
            title: 'Premium Toolkit',
            description: 'Finance notes',
            resource_type: 'template',
            resource_mode: 'pdf',
            phase: null,
            program_keys: ['mba'],
            cohort_names: ['MBA June'],
            url: null,
            access_type: 'paid',
            hasAccess: false,
            locked: true,
            lockReason: 'Payment required',
            price: null,
            currency: null,
            updated_at: null
          }
        ]
      },
      error: null
    };

    const result = await service.listMyResources(createUser(), 'student-token', {
      page: 2,
      limit: 1,
      accessType: 'free',
      resourceType: 'template',
      search: ' finance '
    });

    expect(result.items.map((item) => item.id)).toEqual(['resource-2']);
    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.hasPreviousPage).toBe(true);
    expect(result.hasNextPage).toBe(false);
  });
});
