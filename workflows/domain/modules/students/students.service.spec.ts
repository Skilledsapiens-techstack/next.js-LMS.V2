import { ForbiddenException, NotFoundException, ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { StudentsService } from './students.service';

type QueryResult = { data: unknown; error: { message: string } | null };
type RpcResult = { data: unknown; error: { message: string } | null };

class MockStudentQuery {
  constructor(private readonly result: QueryResult) {}

  select() {
    return this;
 }

  or() {
    return this;
 }

  limit() {
    return Promise.resolve(this.result);
 }
}

class MockSupabaseAdmin {
  studentResult: QueryResult = { data: [], error: null };
  rpcResults = new Map<string, RpcResult>();
  rpcCalls: Array<{ functionName: string; params: Record<string, string> }> = [];

  from(tableName: string) {
    if (tableName !== 'students') {
      throw new Error(`Unexpected table: ${tableName}`);
   }

    return new MockStudentQuery(this.studentResult);
 }

  rpc(functionName: string, params: Record<string, string>) {
    this.rpcCalls.push({ functionName, params });
    return Promise.resolve(this.rpcResults.get(functionName) ?? { data: {}, error: null });
 }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();

  forUser(_accessToken: string) {
    return {
      rpc: (functionName: string, params: Record<string, string>) => this.admin.rpc(functionName, params)
   };
 }
}

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'auth-user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date('2026-06-26T00:00:00.000Z').toISOString(),
    email: 'Student@Example.com',
    ...overrides
 };
}

describe('StudentsService', () => {
  let admin: MockSupabaseAdmin;
  let supabase: MockSupabase;
  let service: StudentsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    admin = supabase.admin;
    service = new StudentsService(supabase as never);
 });

  it('returns the active student profile linked to the Supabase user', async () => {
    admin.studentResult = {
      data: [
        {
          id: 'student-uuid',
          student_id: 'STU-001',
          full_name: 'Student One',
          email: 'student@example.com',
          college_name: 'College',
          cohort_name: 'Cohort A',
          program_name: 'Program A',
          track_role_ids: ['role-1'],
          auth_user_id: 'auth-user-1',
          active: true
       }
      ],
      error: null
   };

    await expect(service.getCurrentStudent(createUser())).resolves.toEqual({
      id: 'student-uuid',
      studentId: 'STU-001',
      fullName: 'Student One',
      email: 'student@example.com',
      collegeName: 'College',
      cohortName: 'Cohort A',
      programName: 'Program A',
      trackRoleIds: ['role-1'],
      active: true
   });
 });

  it('blocks inactive students', async () => {
    admin.studentResult = {
      data: [
        {
          id: 'student-uuid',
          student_id: 'STU-001',
          full_name: 'Student One',
          email: 'student@example.com',
          college_name: null,
          cohort_name: null,
          program_name: null,
          track_role_ids: [],
          auth_user_id: 'auth-user-1',
          active: false
       }
      ],
      error: null
   };

    await expect(service.getCurrentStudent(createUser())).rejects.toBeInstanceOf(ForbiddenException);
 });

  it('returns not found when no Supabase student profile is linked', async () => {
    admin.studentResult = { data: [], error: null };

    await expect(service.getCurrentStudent(createUser())).rejects.toBeInstanceOf(NotFoundException);
 });

  it('loads the dashboard through Supabase RPC bundles only', async () => {
    admin.studentResult = {
      data: [
        {
          id: 'student-uuid',
          student_id: null,
          full_name: 'Student One',
          email: 'student@example.com',
          college_name: null,
          cohort_name: null,
          program_name: null,
          track_role_ids: [],
          auth_user_id: 'auth-user-1',
          active: true
       }
      ],
      error: null
   };
    admin.rpcResults.set('student_dashboard_bundle', { data: { schedule: [] }, error: null });
    admin.rpcResults.set('student_resources_view', { data: { resources: [] }, error: null });
    admin.rpcResults.set('student_projects_bundle', { data: { projects: [] }, error: null });
    admin.rpcResults.set('student_certificates_bundle', { data: { certificates: [] }, error: null });

    const dashboard = await service.getCurrentStudentDashboard(createUser(), 'student-token');

    expect(dashboard.student.email).toBe('student@example.com');
    expect(dashboard.resources).toEqual({ resources: [] });
    expect(admin.rpcCalls.map((call) => call.functionName)).toEqual([
      'student_dashboard_bundle',
      'student_resources_view',
      'student_projects_bundle',
      'student_certificates_bundle'
    ]);
    expect(admin.rpcCalls.every((call) => call.params.p_student_email === 'student@example.com')).toBe(true);
 });

  it('surfaces Supabase RPC failures as service unavailable', async () => {
    admin.studentResult = {
      data: [
        {
          id: 'student-uuid',
          student_id: null,
          full_name: 'Student One',
          email: 'student@example.com',
          college_name: null,
          cohort_name: null,
          program_name: null,
          track_role_ids: [],
          auth_user_id: 'auth-user-1',
          active: true
       }
      ],
      error: null
   };
    admin.rpcResults.set('student_dashboard_bundle', { data: null, error: { message: 'missing rpc' } });

    await expect(service.getCurrentStudentDashboard(createUser(), 'student-token')).rejects.toBeInstanceOf(ServiceUnavailableException);
 });
});
