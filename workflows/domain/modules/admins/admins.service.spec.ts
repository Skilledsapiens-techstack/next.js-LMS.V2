import { ForbiddenException, NotFoundException, ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { AdminsService } from './admins.service';

type QueryResult = { count?: number | null; data: unknown; error: { message: string } | null };
type RpcResult = { data: unknown; error: { message: string } | null };

class MockAdminQuery {
  constructor(private readonly result: QueryResult) {}

  select() {
    return this;
 }

  or() {
    return this;
 }

  eq() {
    return this;
 }

  limit() {
    return Promise.resolve(this.result);
 }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
 }
}

class MockSupabaseAdmin {
  adminResult: QueryResult = { data: [], error: null };
  rpcResult: RpcResult = { data: {}, error: null };
  workshopCountResult: QueryResult = { count: 0, data: null, error: null };
  rpcCalls: Array<{ functionName: string; params?: Record<string, string> }> = [];
  tableCalls: string[] = [];

  from(tableName: string) {
    this.tableCalls.push(tableName);

    if (tableName === 'admin_users') {
      return new MockAdminQuery(this.adminResult);
   }

    if (tableName === 'workshops') {
      return new MockAdminQuery(this.workshopCountResult);
   }

    throw new Error(`Unexpected table: ${tableName}`);
 }
}

class MockUserSupabase {
  constructor(private readonly root: MockSupabase) {}

  rpc(functionName: string, params?: Record<string, string>) {
    this.root.admin.rpcCalls.push({ functionName, params });
    return Promise.resolve(this.root.admin.rpcResult);
 }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
  userTokens: string[] = [];

  forUser(accessToken: string) {
    this.userTokens.push(accessToken);
    return new MockUserSupabase(this);
 }
}

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'auth-admin-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date('2026-06-26T00:00:00.000Z').toISOString(),
    email: 'Admin@Example.com',
    ...overrides
 };
}

describe('AdminsService', () => {
  let supabase: MockSupabase;
  let service: AdminsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    service = new AdminsService(supabase as never);
 });

  it('returns the active admin profile linked to the Supabase user', async () => {
    supabase.admin.adminResult = {
      data: [
        {
          id: 'admin-uuid',
          auth_user_id: 'auth-admin-1',
          email: 'admin@example.com',
          full_name: 'Admin One',
          role: 'owner',
          status: 'active'
       }
      ],
      error: null
   };

    await expect(service.getCurrentAdmin(createUser())).resolves.toEqual({
      id: 'admin-uuid',
      email: 'admin@example.com',
      fullName: 'Admin One',
      role: 'owner',
      status: 'active'
   });
 });

  it('blocks inactive admins', async () => {
    supabase.admin.adminResult = {
      data: [
        {
          id: 'admin-uuid',
          auth_user_id: 'auth-admin-1',
          email: 'admin@example.com',
          full_name: null,
          role: 'admin',
          status: 'inactive'
       }
      ],
      error: null
   };

    await expect(service.getCurrentAdmin(createUser())).rejects.toBeInstanceOf(ForbiddenException);
 });

  it('returns not found when no Supabase admin profile is linked', async () => {
    supabase.admin.adminResult = { data: [], error: null };

    await expect(service.getCurrentAdmin(createUser())).rejects.toBeInstanceOf(NotFoundException);
 });

  it('loads dashboard summary with the user-context Supabase client', async () => {
    supabase.admin.adminResult = {
      data: [
        {
          id: 'admin-uuid',
          auth_user_id: 'auth-admin-1',
          email: 'admin@example.com',
          full_name: null,
          role: 'operations',
          status: 'active'
       }
      ],
      error: null
   };
    supabase.admin.rpcResult = { data: { source: 'supabase_direct', students: { active: 10 } }, error: null };
    supabase.admin.workshopCountResult = { count: 18, data: null, error: null };

    const dashboard = await service.getDashboard(
      {
        id: 'admin-uuid',
        email: 'admin@example.com',
        role: 'operations',
        status: 'active'
     },
      'admin-token'
    );

    expect(dashboard.summary).toEqual({
      publishedRecordings: { total: 18 },
      recordings: { published: 18, total: 18 },
      source: 'supabase_direct',
      students: { active: 10 }
   });
    expect(supabase.userTokens).toEqual(['admin-token']);
    expect(supabase.admin.rpcCalls).toEqual([{ functionName: 'lms_admin_dashboard_summary', params: undefined }]);
    expect(supabase.admin.tableCalls).toContain('workshops');
 });

  it('surfaces Supabase RPC failures as service unavailable', async () => {
    supabase.admin.rpcResult = { data: null, error: { message: 'unauthorized' } };

    await expect(
      service.getDashboard(
        {
          id: 'admin-uuid',
          email: 'admin@example.com',
          role: 'admin',
          status: 'active'
       },
        'admin-token'
      )
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
 });

  it('surfaces published recording count failures as service unavailable', async () => {
    supabase.admin.rpcResult = { data: { students: { active: 10 } }, error: null };
    supabase.admin.workshopCountResult = { count: null, data: null, error: { message: 'count failed' } };

    await expect(
      service.getDashboard(
        {
          id: 'admin-uuid',
          email: 'admin@example.com',
          role: 'admin',
          status: 'active'
       },
        'admin-token'
      )
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
 });

});
