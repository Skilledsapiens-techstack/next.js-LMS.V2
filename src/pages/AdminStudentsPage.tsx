import { Download, Eye, FileUp, Plus, RefreshCw, Search, X } from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminStudent,
  AdminStudentStatus,
  AdminStudentWritePayload,
  useAdminStudentAttemptLimit,
  useAdminStudents,
  useImportAdminStudents,
  useSaveAdminStudent,
  useUpdateAdminStudent,
  useUpdateAdminStudentAttemptLimit,
  useUpdateAdminStudentStatus
} from '../features/admin/useAdminStudents';
import { AdminCohort, useAdminCohorts } from '../features/admin/useAdminCohorts';
import { AdminProgram, useAdminPrograms } from '../features/admin/useAdminPrograms';

const statusOptions: Array<{ label: string; value: AdminStudentStatus | 'all' }> = [
  { label: 'All Students', value: 'all' },
  { label: 'Active Students', value: 'active' },
  { label: 'Inactive Students', value: 'inactive' }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parseStatus(value: string | null): AdminStudentStatus | 'all' {
  return statusOptions.some((option) => option.value === value) ? (value as AdminStudentStatus | 'all') : 'all';
}

function formatDate(value: string | undefined) {
  if (!value) return '-';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatValue(value: string | number | undefined | null) {
  if (value === null || value === undefined) return '-';
  const normalized = String(value).trim();
  return normalized || '-';
}

function formatList(values: Array<string | undefined> | undefined, fallback?: string) {
  const normalized = values?.map((value) => value?.trim()).filter((value): value is string => Boolean(value)) ?? [];
  if (normalized.length > 0) return normalized.join(', ');
  return formatValue(fallback);
}

function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));
}

function buildPageLink(page: number, search: string, status: AdminStudentStatus | 'all', cohortName: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (cohortName) params.set('cohortName', cohortName);
  return `?${params.toString()}`;
}

function avatarLabel(name: string) {
  return (name.trim()[0] ?? 'S').toUpperCase();
}

function csvEscape(value: string | number | boolean | undefined | null) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizedHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="student-detail-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StudentDetailsModal({ student, onClose }: { student: AdminStudent; onClose: () => void }) {
  const detailRows = [
    ['Full Name', formatValue(student.fullName)],
    ['Email ID', formatValue(student.email)],
    ['Alt. Email', formatValue(student.altEmail)],
    ['Phone', formatValue(student.phone)],
    ['College', formatValue(student.collegeName)],
    ['Cohorts', formatValue(student.cohortName)],
    ['Slot', formatValue(student.slot)],
    ['Live Project Domain(s)', formatList(student.liveProjectDomains, student.trackRoleIds.join(', '))],
    ['WA Group', formatValue(student.waGroup)],
    ['Programs', formatList(student.programs, student.programName)],
    ['Dual', student.trackRoleIds.length > 1 ? 'Yes' : 'No'],
    ['Enrolled Date', formatDate(student.enrolledDate ?? student.updatedAt)],
    ['Onboarding Mail Status', formatValue(student.onboardingMailStatus)],
    ['Active', student.active ? 'Yes' : 'No']
  ];

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="student-details-title" aria-modal="true" className="student-modal" role="dialog">
        <header className="student-modal__header">
          <h2 id="student-details-title">Student Details</h2>
          <button aria-label="Close student details" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={26} />
          </button>
        </header>
        <div className="student-modal__body">
          <div className="student-detail-grid">
            {detailRows.map(([label, value]) => (
              <DetailField key={label} label={label} value={value} />
            ))}
          </div>
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button" onClick={onClose} type="button">
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}

type EnrollStudentModalProps = {
  cohortOptions: AdminCohort[];
  collegeOptions: string[];
  mode: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (payload: AdminStudentWritePayload) => Promise<void>;
  programOptions: AdminProgram[];
  student?: AdminStudent;
};

type EnrollStudentForm = {
  active: 'yes' | 'no';
  altEmail: string;
  cohortNames: string[];
  collegeName: string;
  email: string;
  fullName: string;
  onboardingMailStatus: 'pending' | 'sent' | 'failed' | 'skipped' | 'dry-run';
  phone: string;
  programNames: string[];
  sendInvite: boolean;
  slot: string;
  studentId: string;
  waGroup: string;
};

const emptyEnrollStudentForm: EnrollStudentForm = {
  active: 'yes',
  altEmail: '',
  cohortNames: [],
  collegeName: '',
  email: '',
  fullName: '',
  onboardingMailStatus: 'pending',
  phone: '',
  programNames: [],
  sendInvite: true,
  slot: '',
  studentId: '',
  waGroup: ''
};

const onboardingMailStatusOptions: Array<{ label: string; value: EnrollStudentForm['onboardingMailStatus'] }> = [
  { label: 'Pending', value: 'pending' },
  { label: 'Sent', value: 'sent' },
  { label: 'Failed', value: 'failed' },
  { label: 'Skipped', value: 'skipped' },
  { label: 'Dry Run', value: 'dry-run' }
];

function studentToForm(student: AdminStudent | undefined): EnrollStudentForm {
  if (!student) return emptyEnrollStudentForm;
  return {
    active: student.active ? 'yes' : 'no',
    altEmail: student.altEmail ?? '',
    cohortNames: student.cohortName ? [student.cohortName] : [],
    collegeName: student.collegeName ?? '',
    email: student.email,
    fullName: student.fullName,
    onboardingMailStatus: (student.onboardingMailStatus as EnrollStudentForm['onboardingMailStatus'] | undefined) ?? 'pending',
    phone: student.phone ?? '',
    programNames: student.programs && student.programs.length > 0 ? student.programs : student.programName ? [student.programName] : [],
    sendInvite: false,
    slot: student.slot ?? '',
    studentId: student.studentId ?? '',
    waGroup: student.waGroup ?? ''
  };
}

function EnrollStudentModal({ cohortOptions, collegeOptions, mode, onClose, onSubmit, programOptions, student }: EnrollStudentModalProps) {
  const [form, setForm] = useState<EnrollStudentForm>(() => studentToForm(student));
  const [isCohortPickerOpen, setIsCohortPickerOpen] = useState(false);
  const [isProgramPickerOpen, setIsProgramPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCohorts = cohortOptions.filter((cohort) => form.cohortNames.includes(cohort.name));
  const selectedCohortSummary =
    selectedCohorts.length > 0
      ? selectedCohorts
          .map((cohort) => [cohort.name, cohort.programKey, cohort.waGroupName, cohort.domainKey].filter(Boolean).join(' · '))
          .join(' | ')
      : 'Select cohorts to review their program, slot, WhatsApp, and Google Group details.';

  function updateForm<K extends keyof EnrollStudentForm>(key: K, value: EnrollStudentForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleCohort(name: string) {
    setForm((current) => ({
      ...current,
      cohortNames: current.cohortNames.includes(name) ? current.cohortNames.filter((item) => item !== name) : [...current.cohortNames, name]
    }));
  }

  function toggleProgram(name: string) {
    setForm((current) => ({
      ...current,
      programNames: current.programNames.includes(name) ? current.programNames.filter((item) => item !== name) : [...current.programNames, name]
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const selectedProgramRecords = programOptions.filter((program) => form.programNames.includes(program.name));
    const payload: AdminStudentWritePayload = {
      active: form.active === 'yes',
      altEmail: form.altEmail || undefined,
      cohortIds: selectedCohorts.map((cohort) => cohort.id),
      cohortNames: form.cohortNames,
      collegeName: form.collegeName || undefined,
      email: form.email,
      fullName: form.fullName,
      onboardingMailStatus: form.onboardingMailStatus,
      phone: form.phone || undefined,
      programKeys: selectedProgramRecords.map((program) => program.programKey),
      programNames: form.programNames,
      sendInvite: form.sendInvite,
      slot: form.slot || undefined,
      studentId: form.studentId || undefined,
      waGroup: form.waGroup || undefined
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Student write failed.');
    }
  }

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="enroll-student-title" aria-modal="true" className="student-modal enroll-student-modal" role="dialog">
        <header className="student-modal__header">
          <h2 id="enroll-student-title">{mode === 'edit' ? 'Edit Student' : 'Enroll New Student'}</h2>
          <button aria-label="Close enroll student form" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={26} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="student-modal__body">
          <div className="enroll-student-form">
            <label>
              <span>Student ID</span>
              <input value={form.studentId} onChange={(event) => updateForm('studentId', event.target.value)} placeholder="Auto if blank" type="text" />
            </label>
            <label>
              <span>Full Name</span>
              <input value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} placeholder="e.g. Aditya Sharma" type="text" />
            </label>
            <label>
              <span>Email Address</span>
              <input value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="student@email.com" type="email" />
            </label>
            <label>
              <span>Alternative Email</span>
              <input value={form.altEmail} onChange={(event) => updateForm('altEmail', event.target.value)} placeholder="optional@email.com" type="email" />
            </label>
            <label>
              <span>Phone Number</span>
              <input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="+91 98765 43210" type="tel" />
            </label>
            <label>
              <span>Slot</span>
              <input value={form.slot} onChange={(event) => updateForm('slot', event.target.value)} placeholder="e.g. Weekend AM" type="text" />
            </label>
            <label>
              <span>WA Group</span>
              <input value={form.waGroup} onChange={(event) => updateForm('waGroup', event.target.value)} placeholder="WhatsApp group name" type="text" />
            </label>
            <label>
              <span>College *</span>
              <select value={form.collegeName} onChange={(event) => updateForm('collegeName', event.target.value)}>
                <option value="">Select approved college</option>
                {collegeOptions.map((college) => (
                  <option key={college} value={college}>
                    {college}
                  </option>
                ))}
              </select>
            </label>

            <div className="enroll-multi-field enroll-student-form__wide">
              <span>Cohorts (select one or more)</span>
              <button className="enroll-picker-button" onClick={() => setIsCohortPickerOpen((current) => !current)} type="button">
                {form.cohortNames.length > 0 ? `${form.cohortNames.length} cohort${form.cohortNames.length === 1 ? '' : 's'} selected` : 'Select cohorts'}
              </button>
              {isCohortPickerOpen ? (
                <div className="enroll-picker-list">
                  {cohortOptions.length > 0 ? (
                    cohortOptions.map((cohort) => (
                      <label className="enroll-picker-row" key={cohort.id}>
                        <input checked={form.cohortNames.includes(cohort.name)} onChange={() => toggleCohort(cohort.name)} type="checkbox" />
                        <strong>{cohort.name}</strong>
                        <span>{cohort.status.toUpperCase()}</span>
                      </label>
                    ))
                  ) : (
                    <p>No cohorts available.</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="enroll-summary enroll-student-form__wide">{selectedCohortSummary}</div>

            <div className="enroll-multi-field enroll-student-form__wide">
              <span>Program Name (select one or more)</span>
              <button className="enroll-picker-button" onClick={() => setIsProgramPickerOpen((current) => !current)} type="button">
                {form.programNames.length > 0 ? `${form.programNames.length} program${form.programNames.length === 1 ? '' : 's'} selected` : 'Select programs'}
              </button>
              {isProgramPickerOpen ? (
                <div className="enroll-picker-list">
                  {programOptions.length > 0 ? (
                    programOptions.map((program) => (
                      <label className="enroll-picker-row" key={program.id}>
                        <input checked={form.programNames.includes(program.name)} onChange={() => toggleProgram(program.name)} type="checkbox" />
                        <strong>{program.name}</strong>
                        <span>{program.programKey}</span>
                      </label>
                    ))
                  ) : (
                    <p>No programs available.</p>
                  )}
                </div>
              ) : null}
            </div>

            <label>
              <span>Onboarding Mail Status</span>
              <select value={form.onboardingMailStatus} onChange={(event) => updateForm('onboardingMailStatus', event.target.value as EnrollStudentForm['onboardingMailStatus'])}>
                {onboardingMailStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Active</span>
              <select value={form.active} onChange={(event) => updateForm('active', event.target.value as EnrollStudentForm['active'])}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="enroll-checkbox enroll-student-form__wide">
              <input checked={form.sendInvite} onChange={(event) => updateForm('sendInvite', event.target.checked)} type="checkbox" />
              <span>Record password setup invite intent</span>
            </label>
            {error ? <div className="form-banner form-banner--error enroll-student-form__wide">{error}</div> : null}
          </div>
          </div>

          <footer className="student-modal__footer enroll-student-modal__footer">
          <button className="segmented-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="segmented-button segmented-button--active" type="submit">
            {mode === 'edit' ? 'Save Student' : 'Enroll Student'} &rarr;
          </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function LpAttemptsModal({ onClose, student }: { onClose: () => void; student: AdminStudent }) {
  const attemptsQuery = useAdminStudentAttemptLimit(student.id);
  const updateAttempts = useUpdateAdminStudentAttemptLimit();
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (attemptsQuery.data) {
      setMaxAttempts(attemptsQuery.data.maxAttempts);
      setNotes(attemptsQuery.data.notes ?? '');
    }
  }, [attemptsQuery.data]);

  async function saveAttempts(nextMaxAttempts = maxAttempts, nextNotes = notes) {
    setError(null);
    try {
      await updateAttempts.mutateAsync({ maxAttempts: nextMaxAttempts, notes: nextNotes || undefined, studentId: student.id });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'LP attempts update failed.');
    }
  }

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="lp-attempts-title" aria-modal="true" className="student-modal" role="dialog">
        <header className="student-modal__header">
          <h2 id="lp-attempts-title">LP Attempts</h2>
          <button aria-label="Close LP attempts" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={26} />
          </button>
        </header>
        <div className="student-modal__body">
          <div className="enroll-student-form">
            <DetailField label="Student" value={`${student.fullName} (${student.email})`} />
            <label>
              <span>Max Attempts</span>
              <input min={0} max={1000} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value))} type="number" />
            </label>
            <label className="enroll-student-form__wide">
              <span>Notes</span>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional reason for the change" type="text" />
            </label>
            {attemptsQuery.isLoading ? <div className="form-banner enroll-student-form__wide">Loading current attempt limit...</div> : null}
            {error ? <div className="form-banner form-banner--error enroll-student-form__wide">{error}</div> : null}
          </div>
        </div>
        <footer className="student-modal__footer enroll-student-modal__footer">
          <button className="segmented-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="segmented-button" disabled={updateAttempts.isPending} onClick={() => void saveAttempts(3, 'Reset to default')} type="button">
            Reset
          </button>
          <button className="segmented-button segmented-button--active" disabled={updateAttempts.isPending || attemptsQuery.isLoading} onClick={() => void saveAttempts()} type="button">
            Save Attempts
          </button>
        </footer>
      </section>
    </div>
  );
}

export function AdminStudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseStatus(searchParams.get('status'));
  const search = searchParams.get('search')?.trim() ?? '';
  const cohortName = searchParams.get('cohortName')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<AdminStudent | null>(null);
  const [attemptStudent, setAttemptStudent] = useState<AdminStudent | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const studentsQuery = useAdminStudents({ page, search, status, cohortName });
  const saveStudent = useSaveAdminStudent();
  const updateStudent = useUpdateAdminStudent();
  const updateStudentStatus = useUpdateAdminStudentStatus();
  const importStudents = useImportAdminStudents();
  const programsQuery = useAdminPrograms({ limit: 100, page: 1, status: 'all' });
  const cohortsPageOneQuery = useAdminCohorts({ limit: 100, page: 1, status: 'all' });
  const cohortsPageTwoQuery = useAdminCohorts({ limit: 100, page: 2, status: 'all' });
  const cohortsPageThreeQuery = useAdminCohorts({ limit: 100, page: 3, status: 'all' });
  const data = studentsQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const cohortOptions = useMemo(() => {
    const values = new Set<string>();
    [cohortsPageOneQuery.data, cohortsPageTwoQuery.data, cohortsPageThreeQuery.data].forEach((pageData) => {
      pageData?.items.forEach((cohort) => values.add(cohort.name));
    });
    data?.items.forEach((student) => {
      if (student.cohortName) values.add(student.cohortName);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [cohortsPageOneQuery.data, cohortsPageTwoQuery.data, cohortsPageThreeQuery.data, data?.items]);
  const cohortRecords = useMemo(() => {
    const values = new Map<string, AdminCohort>();
    [cohortsPageOneQuery.data, cohortsPageTwoQuery.data, cohortsPageThreeQuery.data].forEach((pageData) => {
      pageData?.items.forEach((cohort) => values.set(cohort.name, cohort));
    });
    return Array.from(values.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cohortsPageOneQuery.data, cohortsPageTwoQuery.data, cohortsPageThreeQuery.data]);
  const programRecords = useMemo(() => programsQuery.data?.items ?? [], [programsQuery.data?.items]);
  const collegeOptions = useMemo(() => uniqueSorted(data?.items.map((student) => student.collegeName) ?? []), [data?.items]);

  function updateParams(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateParams({ search: searchInput.trim() || undefined });
  }

  function handleCohortChange(nextCohortName: string) {
    updateParams({ cohortName: nextCohortName === 'all' ? undefined : nextCohortName });
  }

  function handleStatusChange(nextStatus: AdminStudentStatus | 'all') {
    updateParams({ status: nextStatus === 'all' ? undefined : nextStatus });
  }

  async function handleCreateStudent(payload: AdminStudentWritePayload) {
    await saveStudent.mutateAsync(payload);
    setActionMessage('Student saved. Profile and selected links were recorded.');
  }

  async function handleEditStudent(payload: AdminStudentWritePayload) {
    if (!editingStudent) return;
    await updateStudent.mutateAsync({ body: payload, studentId: editingStudent.id });
    setActionMessage('Student updated.');
  }

  async function handleToggleStudent(student: AdminStudent) {
    await updateStudentStatus.mutateAsync({ active: !student.active, studentId: student.id });
    setActionMessage(student.active ? 'Student deactivated.' : 'Student reactivated.');
  }

  function handleExportCsv() {
    if (!data?.items.length) return;
    const headers = ['studentId', 'fullName', 'email', 'altEmail', 'phone', 'collegeName', 'cohortName', 'slot', 'programs', 'waGroup', 'onboardingMailStatus', 'active'];
    const lines = [
      headers.join(','),
      ...data.items.map((student) =>
        [
          student.studentId,
          student.fullName,
          student.email,
          student.altEmail,
          student.phone,
          student.collegeName,
          student.cohortName,
          student.slot,
          formatList(student.programs, student.programName),
          student.waGroup,
          student.onboardingMailStatus,
          student.active
        ]
          .map(csvEscape)
          .join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `students-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const rows = parseCsvRows(await file.text());
    const [headers, ...bodyRows] = rows;
    if (!headers || bodyRows.length === 0) {
      setActionMessage('CSV import skipped: no student rows found.');
      return;
    }

    const headerMap = new Map(headers.map((header, index) => [normalizedHeader(header), index]));
    const getValue = (row: string[], names: string[]) => {
      const index = names.map((name) => headerMap.get(normalizedHeader(name))).find((value) => value !== undefined);
      return index === undefined ? '' : row[index]?.trim() ?? '';
    };
    const splitList = (value: string) =>
      value
        .split(/[|;]/)
        .map((item) => item.trim())
        .filter(Boolean);
    const cohortByName = new Map(cohortRecords.map((cohort) => [cohort.name.toLowerCase(), cohort]));
    const programByName = new Map(programRecords.map((program) => [program.name.toLowerCase(), program]));
    const programByKey = new Map(programRecords.map((program) => [program.programKey.toLowerCase(), program]));

    const payload = bodyRows
      .map((row) => {
        const cohortNames = splitList(getValue(row, ['cohortNames', 'cohortName', 'cohorts']));
        const programValues = splitList(getValue(row, ['programNames', 'programName', 'programs', 'programKeys']));
        const selectedCohorts = cohortNames.map((name) => cohortByName.get(name.toLowerCase())).filter((cohort): cohort is AdminCohort => Boolean(cohort));
        const selectedPrograms = programValues
          .map((name) => programByName.get(name.toLowerCase()) ?? programByKey.get(name.toLowerCase()))
          .filter((program): program is AdminProgram => Boolean(program));
        const activeValue = getValue(row, ['active', 'status']).toLowerCase();
        return {
          active: activeValue ? !['false', 'inactive', 'no', '0'].includes(activeValue) : true,
          altEmail: getValue(row, ['altEmail', 'alternateEmail']) || undefined,
          cohortIds: selectedCohorts.map((cohort) => cohort.id),
          cohortNames,
          collegeName: getValue(row, ['collegeName', 'college']) || undefined,
          email: getValue(row, ['email', 'emailAddress']),
          fullName: getValue(row, ['fullName', 'name']),
          onboardingMailStatus: (getValue(row, ['onboardingMailStatus']) || 'pending') as AdminStudentWritePayload['onboardingMailStatus'],
          phone: getValue(row, ['phone', 'phoneNumber']) || undefined,
          programKeys: selectedPrograms.map((program) => program.programKey),
          programNames: selectedPrograms.length > 0 ? selectedPrograms.map((program) => program.name) : programValues,
          sendInvite: false,
          slot: getValue(row, ['slot']) || undefined,
          studentId: getValue(row, ['studentId', 'studentID']) || undefined,
          waGroup: getValue(row, ['waGroup', 'waGroupName', 'whatsappGroup']) || undefined
        };
      })
      .filter((student) => student.email && student.fullName);

    if (payload.length === 0) {
      setActionMessage('CSV import skipped: rows need at least fullName and email.');
      return;
    }

    const result = await importStudents.mutateAsync(payload);
    setActionMessage(`CSV import finished: ${result.created} created, ${result.updated} updated, ${result.failed} failed.`);
  }

  if (studentsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading student operations list." eyebrow="Module refresh" title="Students" />
        <LoadingState />
      </div>
    );
  }

  if (studentsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Students could not be loaded right now." eyebrow="Module refresh" title="Students unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        actions={
          <button className="segmented-button" disabled={studentsQuery.isFetching} onClick={() => void studentsQuery.refetch()} type="button">
            <RefreshCw size={16} />
            Refresh Students
          </button>
        }
        description="Refresh only students data from the database."
        eyebrow="Module refresh"
        title="Students"
      />

      <section className="admin-student-toolbar" aria-label="Student admin tools">
        <form className="filter-search filter-search--form admin-student-search" onSubmit={handleSearch}>
          <Search size={18} />
          <label className="sr-only" htmlFor="admin-student-search">
            Search students
          </label>
          <input id="admin-student-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search students" type="search" />
        </form>
        <select aria-label="Filter by cohort" className="admin-student-select" value={cohortName || 'all'} onChange={(event) => handleCohortChange(event.target.value)}>
          <option value="all">All Cohorts</option>
          {cohortOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select aria-label="Filter by student status" className="admin-student-select" value={status} onChange={(event) => handleStatusChange(event.target.value as AdminStudentStatus | 'all')}>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="admin-student-actions">
          <button className="segmented-button" disabled={!data?.items.length} onClick={handleExportCsv} type="button">
            <Download size={16} />
            Export CSV
          </button>
          <label className="segmented-button" aria-disabled={importStudents.isPending}>
            <FileUp size={16} />
            Import CSV
            <input accept=".csv,text/csv" className="sr-only" disabled={importStudents.isPending} onChange={handleImportCsv} type="file" />
          </label>
          <button className="segmented-button segmented-button--active" onClick={() => setIsEnrollModalOpen(true)} type="button">
            <Plus size={16} />
            Enroll Student
          </button>
        </div>
      </section>

      {actionMessage ? <div className="form-banner">{actionMessage}</div> : null}

      {data && data.items.length > 0 ? (
        <section className="admin-student-table-card" aria-label="Student records">
          <div className="data-table-wrap admin-student-table-wrap">
            <table className="data-table admin-student-table">
              <colgroup>
                <col className="admin-student-col--serial" />
                <col className="admin-student-col--dual" />
                <col className="admin-student-col--name" />
                <col className="admin-student-col--college" />
                <col className="admin-student-col--email" />
                <col className="admin-student-col--email" />
                <col className="admin-student-col--phone" />
                <col className="admin-student-col--cohort" />
                <col className="admin-student-col--slot" />
                <col className="admin-student-col--domain" />
                <col className="admin-student-col--wa" />
                <col className="admin-student-col--date" />
                <col className="admin-student-col--programs" />
                <col className="admin-student-col--status" />
                <col className="admin-student-col--actions" />
              </colgroup>
              <thead>
                <tr>
                  <th className="admin-student-heading--nowrap" scope="col">S. No.</th>
                  <th scope="col">Dual</th>
                  <th scope="col">Full Name</th>
                  <th scope="col">College</th>
                  <th scope="col">Email ID</th>
                  <th scope="col">Alt Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Cohorts</th>
                  <th scope="col">Slot</th>
                  <th scope="col">Live Project Domain(s)</th>
                  <th scope="col">WA Group</th>
                  <th scope="col">Onboarding Date</th>
                  <th scope="col">Programs</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((student, index) => (
                  <tr key={student.id}>
                    <td>{(page - 1) * (data.limit ?? 25) + index + 1}</td>
                    <td>{student.trackRoleIds.length > 1 ? 'Yes' : '-'}</td>
                    <td>
                      <div className="admin-student-name">
                        <span>{avatarLabel(student.fullName)}</span>
                        <strong>{formatValue(student.fullName)}</strong>
                      </div>
                    </td>
                    <td>{formatValue(student.collegeName)}</td>
                    <td>{formatValue(student.email)}</td>
                    <td>{formatValue(student.altEmail)}</td>
                    <td>{formatValue(student.phone)}</td>
                    <td>
                      <span className="admin-student-chip">{formatValue(student.cohortName)}</span>
                    </td>
                    <td>{formatValue(student.slot)}</td>
                    <td>{formatList(student.liveProjectDomains, student.trackRoleIds.join(', '))}</td>
                    <td>{formatValue(student.waGroup)}</td>
                    <td>{formatDate(student.enrolledDate ?? student.updatedAt)}</td>
                    <td>
                      <span className="admin-student-programs">{formatList(student.programs, student.programName)}</span>
                    </td>
                    <td>
                      <StatusBadge tone={student.active ? 'safe' : 'warning'}>{student.active ? 'Active' : 'Inactive'}</StatusBadge>
                    </td>
                    <td>
                      <div className="admin-student-row-actions">
                        <button className="segmented-button" onClick={() => setSelectedStudent(student)} type="button">
                          <Eye size={15} />
                          View
                        </button>
                        <button className="segmented-button" onClick={() => setEditingStudent(student)} type="button">
                          Edit
                        </button>
                        <button className="segmented-button" onClick={() => setAttemptStudent(student)} type="button">
                          LP Attempts
                        </button>
                        <button className="segmented-button" disabled={updateStudentStatus.isPending} onClick={() => void handleToggleStudent(student)} type="button">
                          {student.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Admin student pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, search, status, cohortName)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, search, status, cohortName)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      {selectedStudent ? <StudentDetailsModal student={selectedStudent} onClose={() => setSelectedStudent(null)} /> : null}
      {isEnrollModalOpen ? (
        <EnrollStudentModal
          cohortOptions={cohortRecords}
          collegeOptions={collegeOptions}
          mode="create"
          onClose={() => setIsEnrollModalOpen(false)}
          onSubmit={handleCreateStudent}
          programOptions={programRecords}
        />
      ) : null}
      {editingStudent ? (
        <EnrollStudentModal
          cohortOptions={cohortRecords}
          collegeOptions={collegeOptions}
          mode="edit"
          onClose={() => setEditingStudent(null)}
          onSubmit={handleEditStudent}
          programOptions={programRecords}
          student={editingStudent}
        />
      ) : null}
      {attemptStudent ? <LpAttemptsModal student={attemptStudent} onClose={() => setAttemptStudent(null)} /> : null}
    </div>
  );
}
