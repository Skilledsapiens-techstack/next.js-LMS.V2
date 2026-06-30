import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { AdminStudentsService } from './admin-students.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

const studentRow = {
  id: 'student-uuid',
  student_id: 'STU-001',
  full_name: 'Student One',
  email: 'STUDENT@EXAMPLE.COM',
  alt_email: null,
  phone: null,
  college_name: 'College',
  cohort_id: 'cohort-uuid',
  cohort_name: 'Cohort A',
  program_name: 'Program A',
  track_role_ids: ['role-1'],
  slot: null,
  wa_group_name: null,
  onboarding_mail_status: 'pending',
  active: true,
  date_of_onboarding: '2026-06-26',
  updated_at: '2026-06-26T00:00:00.000Z'
};

class MockTableQuery {
  filters: Array<{ args: unknown[]; method: string }> = [];
  payloads: unknown[] = [];

  constructor(
    private readonly tableName: string,
    private readonly admin: MockSupabaseAdmin
  ) {}

  select(...args: unknown[]) {
    this.filters.push({ method: 'select', args });
    return this;
 }

  order(...args: unknown[]) {
    this.filters.push({ method: 'order', args });
    return this;
 }

  range(...args: unknown[]) {
    this.filters.push({ method: 'range', args });
    return this;
 }

  eq(...args: unknown[]) {
    this.filters.push({ method: 'eq', args });
    return this;
 }

  or(...args: unknown[]) {
    this.filters.push({ method: 'or', args });
    return this;
 }

  upsert(...args: unknown[]) {
    this.filters.push({ method: 'upsert', args });
    this.payloads.push(args[0]);
    this.admin.upserts.push({ payload: args[0], tableName: this.tableName });
    return this;
 }

  update(...args: unknown[]) {
    this.filters.push({ method: 'update', args });
    this.payloads.push(args[0]);
    this.admin.updates.push({ payload: args[0], tableName: this.tableName });
    return this;
 }

  insert(...args: unknown[]) {
    this.filters.push({ method: 'insert', args });
    this.payloads.push(args[0]);
    this.admin.inserts.push({ payload: args[0], tableName: this.tableName });
    return { error: null };
 }

  single() {
    return this.resolveResult();
 }

  maybeSingle() {
    if (this.tableName === 'students') return Promise.resolve({ data: this.admin.existingStudent, error: null });
    if (this.tableName === 'project_submission_student_limits') return Promise.resolve({ data: this.admin.attemptLimit, error: null });
    return Promise.resolve({ data: null, error: null });
 }

  then(resolve: (value: QueryResult) => void) {
    resolve(this.resolveResult());
 }

  private resolveResult(): QueryResult {
    if (this.tableName === 'students') {
      if (this.filters.some((filter) => filter.method === 'upsert' || filter.method === 'update')) {
        return { data: this.admin.savedStudent, error: null };
     }
      if (this.admin.existingStudent) {
        return { data: this.admin.existingStudent, error: null };
     }
      return this.admin.studentsResult;
   }

    if (this.tableName === 'project_submission_student_limits') {
      return { data: this.admin.savedAttemptLimit, error: null };
   }

    return { data: null, error: null };
 }
}

class MockSupabaseAdmin {
  attemptLimit: unknown = null;
  existingStudent: unknown = null;
  inserts: Array<{ payload: unknown; tableName: string }> = [];
  lastQuery?: MockTableQuery;
  savedAttemptLimit: unknown = {
    max_attempts: 5,
    notes: 'More attempts',
    student_email: 'student@example.com',
    student_id: 'student-uuid',
    updated_at: '2026-06-30T00:00:00.000Z'
 };
  savedStudent: unknown = studentRow;
  studentsResult: QueryResult = { data: [], error: null, count: 0 };
  updates: Array<{ payload: unknown; tableName: string }> = [];
  upserts: Array<{ payload: unknown; tableName: string }> = [];

  from(tableName: string) {
    this.lastQuery = new MockTableQuery(tableName, this);
    return this.lastQuery;
 }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

class MockConfig {
  constructor(private readonly writesEnabled: boolean) {}

  get() {
    return this.writesEnabled;
 }
}

describe('AdminStudentsService', () => {
  let supabase: MockSupabase;
  let service: AdminStudentsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    service = new AdminStudentsService(supabase as never, new MockConfig(true) as never);
 });

  it('lists students with bounded pagination metadata', async () => {
    supabase.admin.studentsResult = {
      data: [studentRow],
      error: null,
      count: 51
   };

    const result = await service.listStudents({ page: 2, limit: 25, status: 'all' });

    expect(result).toEqual({
      items: [
        {
          active: true,
          cohortName: 'Cohort A',
          collegeName: 'College',
          email: 'student@example.com',
          enrolledDate: '2026-06-26',
          fullName: 'Student One',
          id: 'student-uuid',
          onboardingMailStatus: 'pending',
          programName: 'Program A',
          programs: ['Program A'],
          studentId: 'STU-001',
          trackRoleIds: ['role-1'],
          updatedAt: '2026-06-26T00:00:00.000Z'
       }
      ],
      page: 2,
      limit: 25,
      total: 51,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true
   });
    expect(supabase.admin.lastQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['updated_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [25, 49] }
      ])
    );
 });

  it('applies active status, cohort, and normalized search filters to student list queries', async () => {
    await service.listStudents({ page: 1, limit: 10, status: 'active', search: ' Student  College ', cohortName: 'Cohort A' });

    expect(supabase.admin.lastQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['active', true] },
        { method: 'eq', args: ['cohort_name', 'Cohort A'] },
        {
          method: 'or',
          args: ['full_name.ilike.%student college%,email.ilike.%student college%,college_name.ilike.%student college%']
       }
      ])
    );
 });

  it('does not attempt Supabase writes when student writes are disabled', async () => {
    service = new AdminStudentsService(supabase as never, new MockConfig(false) as never);

    await expect(
      service.saveStudent(
        {
          email: 'student@example.com',
          fullName: 'Student One'
       },
        'admin@example.com'
      )
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(supabase.admin.upserts).toEqual([]);
 });

  it('creates or updates students, links cohorts and programs, and records audit logs', async () => {
    const result = await service.saveStudent(
      {
        active: true,
        cohortIds: ['cohort-uuid'],
        cohortNames: ['Cohort A'],
        email: 'STUDENT@EXAMPLE.COM',
        fullName: 'Student One',
        programKeys: ['mclp'],
        programNames: ['Program A'],
        sendInvite: true
     },
      'Admin@Example.com'
    );

    expect(result.email).toBe('student@example.com');
    expect(supabase.admin.upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tableName: 'students' }),
        expect.objectContaining({ tableName: 'student_programs' }),
        expect.objectContaining({ tableName: 'student_cohorts' })
      ])
    );
    expect(supabase.admin.inserts).toEqual([expect.objectContaining({ tableName: 'audit_logs' })]);
 });

  it('deactivates students and records the status audit', async () => {
    supabase.admin.existingStudent = studentRow;
    await service.updateStudentActive('student-uuid', false, 'admin@example.com');

    expect(supabase.admin.updates).toEqual([expect.objectContaining({ payload: expect.objectContaining({ active: false }), tableName: 'students' })]);
    expect(supabase.admin.inserts[0]).toEqual(expect.objectContaining({ tableName: 'audit_logs' }));
 });

  it('updates live project attempt limits and records audit logs', async () => {
    supabase.admin.existingStudent = studentRow;
    const result = await service.updateAttemptLimit('student-uuid', { maxAttempts: 5, notes: 'More attempts' }, 'admin@example.com');

    expect(result).toEqual({
      maxAttempts: 5,
      notes: 'More attempts',
      studentEmail: 'student@example.com',
      studentId: 'student-uuid',
      updatedAt: '2026-06-30T00:00:00.000Z'
   });
    expect(supabase.admin.upserts).toEqual([expect.objectContaining({ tableName: 'project_submission_student_limits' })]);
    expect(supabase.admin.inserts[0]).toEqual(expect.objectContaining({ tableName: 'audit_logs' }));
 });
});
