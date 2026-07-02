import { CheckSquare, Download, Eye, FileUp, History, Link2, Mail, Plus, RefreshCw, Search, Square, UserCheck, Users, X } from 'lucide-react';
import { DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Sheet, SheetData } from 'write-excel-file/browser';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminStudent,
  AdminStudentAuthStatus,
  AdminStudentImportRowResult,
  AdminStudentStatus,
  AdminStudentWritePayload,
  AdminStudentsBulkPayload,
  useAdminStudentAuditLogs,
  useAdminStudentAuthStatuses,
  useAdminStudentAttemptLimit,
  useAdminStudentAccessPreview,
  useAdminStudentInviteHealth,
  useAdminStudents,
  useBackfillAdminStudentAuthLinks,
  useBulkUpdateAdminStudents,
  useExportAdminStudents,
  useImportAdminStudents,
  useResendAdminStudentInvite,
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

const studentImportHeaders = ['studentId', 'fullName', 'email', 'altEmail', 'phone', 'collegeName', 'cohortNames', 'programNames', 'waGroup', 'onboardingMailStatus', 'active'];

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

function studentCohortNames(student: AdminStudent) {
  if (student.cohortNames && student.cohortNames.length > 0) return student.cohortNames;
  if (student.cohorts && student.cohorts.length > 0) return student.cohorts.map((cohort) => cohort.cohortName);
  return student.cohortName ? [student.cohortName] : [];
}

function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));
}

function deriveSlotFromCohortStartDate(cohort: AdminCohort | undefined) {
  if (!cohort?.startDate) return '';
  const date = new Date(cohort.startDate);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getDay();
  const dayType = day === 0 || day === 6 ? 'Weekend' : 'Weekday';
  const hour = date.getHours();
  const period = hour >= 17 ? 'Evening' : hour >= 12 ? 'PM' : 'AM';
  return `${dayType} ${period}`;
}

function deriveSlotFromSelectedCohorts(cohorts: AdminCohort[]) {
  return cohorts.map(deriveSlotFromCohortStartDate).find(Boolean) ?? '';
}

function buildPageLink(page: number, search: string, status: AdminStudentStatus | 'all', cohortName: string, programKey: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (cohortName) params.set('cohortName', cohortName);
  if (programKey) params.set('programKey', programKey);
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

function splitImportList(value: string) {
  return value
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeImportStatus(value: string): AdminStudentWritePayload['onboardingMailStatus'] {
  const normalized = value.trim().toLowerCase();
  return ['pending', 'sent', 'failed', 'skipped', 'dry-run'].includes(normalized) ? (normalized as AdminStudentWritePayload['onboardingMailStatus']) : 'pending';
}

function makeHeaderReader(headers: string[]) {
  const headerMap = new Map(headers.map((header, index) => [normalizedHeader(header), index]));
  return (row: string[], names: string[]) => {
    const index = names.map((name) => headerMap.get(normalizedHeader(name))).find((value) => value !== undefined);
    return index === undefined ? '' : row[index]?.trim() ?? '';
  };
}

async function readImportRows(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'xlsx') {
    const { readSheet } = await import('read-excel-file/browser');
    const sheetRows = await readSheet(file);
    return sheetRows
      .map((row) => row.map((cell) => String(cell ?? '').trim()))
      .filter((row) => row.some(Boolean));
  }
  return parseCsvRows(await file.text());
}

function validateImportPayload(
  payload: AdminStudentWritePayload,
  cohortByName: Map<string, AdminCohort>,
  programByKeyOrName: Map<string, AdminProgram>,
  duplicateEmail: boolean
) {
  const errors: string[] = [];
  const email = payload.email.trim().toLowerCase();
  if (!payload.fullName.trim()) errors.push('Full name missing');
  if (!email) errors.push('Email missing');
  else if (!isValidEmail(email)) errors.push('Email invalid');
  else if (duplicateEmail) errors.push('Duplicate email in file');
  if (payload.altEmail && !isValidEmail(payload.altEmail)) errors.push('Alt email invalid');
  const missingCohorts = (payload.cohortNames ?? []).filter((name) => !cohortByName.has(name.toLowerCase()));
  if (missingCohorts.length > 0) errors.push(`Unknown cohorts: ${missingCohorts.join(', ')}`);
  const missingPrograms = (payload.programNames ?? []).filter((name) => !programByKeyOrName.has(name.toLowerCase()));
  if (missingPrograms.length > 0) errors.push(`Unknown programs: ${missingPrograms.join(', ')}`);
  return errors;
}

function buildImportPayloadFromRow(row: string[], headers: string[], cohortByName: Map<string, AdminCohort>, programByKeyOrName: Map<string, AdminProgram>) {
  const getValue = makeHeaderReader(headers);
  const cohortNames = splitImportList(getValue(row, ['cohortNames', 'cohortName', 'cohorts']));
  const programValues = splitImportList(getValue(row, ['programNames', 'programName', 'programs', 'programKeys']));
  const selectedCohorts = cohortNames.map((name) => cohortByName.get(name.toLowerCase())).filter((cohort): cohort is AdminCohort => Boolean(cohort));
  const selectedPrograms = programValues.map((name) => programByKeyOrName.get(name.toLowerCase())).filter((program): program is AdminProgram => Boolean(program));
  const activeValue = getValue(row, ['active', 'status']).toLowerCase();
  const derivedSlot = deriveSlotFromSelectedCohorts(selectedCohorts);

  return {
    active: activeValue ? !['false', 'inactive', 'no', '0'].includes(activeValue) : true,
    altEmail: getValue(row, ['altEmail', 'alternateEmail']) || undefined,
    cohortIds: selectedCohorts.map((cohort) => cohort.id),
    cohortNames,
    collegeName: getValue(row, ['collegeName', 'college']) || undefined,
    email: getValue(row, ['email', 'emailAddress']).toLowerCase(),
    fullName: getValue(row, ['fullName', 'name']),
    onboardingMailStatus: normalizeImportStatus(getValue(row, ['onboardingMailStatus'])),
    phone: getValue(row, ['phone', 'phoneNumber']) || undefined,
    programKeys: selectedPrograms.map((program) => program.programKey),
    programNames: selectedPrograms.length > 0 ? selectedPrograms.map((program) => program.name) : programValues,
    sendInvite: false,
    slot: derivedSlot || undefined,
    studentId: getValue(row, ['studentId', 'studentID']) || undefined,
    waGroup: getValue(row, ['waGroup', 'waGroupName', 'whatsappGroup']) || undefined
  } satisfies AdminStudentWritePayload;
}

type StudentImportPreviewRow = {
  errors: string[];
  existingStudent: boolean;
  payload: AdminStudentWritePayload;
  rowNumber: number;
  sendOnboardingMail: boolean;
  sendPortalInvite: boolean;
};

type StudentImportPreview = {
  fileName: string;
  rows: StudentImportPreviewRow[];
};

type BulkAssignForm = {
  assignmentMode: 'add' | 'replace';
  cohortNames: string[];
  programNames: string[];
};

type StudentImportAssignmentMode = 'add' | 'replace';
type StudentImportPreviewFilter = 'all' | 'errors' | 'new' | 'existing';

function summarizeAuthStatus(status: AdminStudentAuthStatus | undefined) {
  if (!status) return 'Checking';
  if (status.authAccountExists) return status.lastSignInAt ? 'Password active' : 'Account created';
  return 'No password yet';
}

function summarizeInviteStatus(status: AdminStudentAuthStatus | undefined, fallback?: string) {
  return status?.inviteStatus ?? fallback ?? 'Not queued';
}

function isFailureMessage(message: string) {
  return /\b(could not|failed|invalid|unavailable|error|skipped)\b/i.test(message);
}

function formatAuditAction(value: string) {
  return value.replace(/^admin_student_/, '').replace(/_/g, ' ');
}

function formatDateTime(value: string | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="student-detail-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StudentImportMultiSelect({
  label,
  onChange,
  options,
  selected
}: {
  label: string;
  onChange: (values: string[]) => void;
  options: Array<{ id: string; label: string; value: string }>;
  selected: string[];
}) {
  const selectedSet = new Set(selected);

  function toggleValue(value: string) {
    onChange(selectedSet.has(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <details className="student-import-picker">
      <summary className="student-import-picker__selected" aria-label={`Selected ${label}`}>
        {selected.length > 0 ? (
          selected.map((item) => (
            <span key={item} className="student-import-chip">
              {item}
            </span>
          ))
        ) : (
          <span className="student-import-chip student-import-chip--empty">No {label} selected</span>
        )}
      </summary>
      <div className="student-import-picker__list" aria-label={`${label} options`}>
        {options.map((option) => (
          <label key={option.id} className="student-import-picker__option">
            <input checked={selectedSet.has(option.value)} onChange={() => toggleValue(option.value)} type="checkbox" />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

function StudentDetailsModal({ student, onClose }: { student: AdminStudent; onClose: () => void }) {
  const accessPreview = useAdminStudentAccessPreview(student.id);
  const detailRows = [
    ['Full Name', formatValue(student.fullName)],
    ['Email ID', formatValue(student.email)],
    ['Alt. Email', formatValue(student.altEmail)],
    ['Phone', formatValue(student.phone)],
    ['College', formatValue(student.collegeName)],
    ['Cohorts', formatList(studentCohortNames(student), student.cohortName)],
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
          <section className="student-access-preview" aria-label="Student access preview">
            <div>
              <span>Access Preview</span>
              <strong>What this student can see now</strong>
            </div>
            {accessPreview.isLoading ? (
              <p>Checking current portal visibility...</p>
            ) : accessPreview.isError ? (
              <p>Access preview could not be loaded.</p>
            ) : accessPreview.data ? (
              <div className="student-access-preview__grid">
                <DetailField label="Cohorts" value={accessPreview.data.cohorts.length > 0 ? accessPreview.data.cohorts.join(', ') : '-'} />
                <DetailField label="Schedule" value={String(accessPreview.data.schedule)} />
                <DetailField label="Recordings" value={String(accessPreview.data.recordings)} />
                <DetailField label="Resources" value={String(accessPreview.data.resources)} />
                <DetailField label="Projects" value={String(accessPreview.data.projects)} />
                <DetailField label="Certificates" value={String(accessPreview.data.certificates)} />
              </div>
            ) : null}
          </section>
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
type PendingStudentStatusChange = {
  student: AdminStudent;
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
    cohortNames: studentCohortNames(student),
    collegeName: student.collegeName ?? '',
    email: student.email,
    fullName: student.fullName,
    onboardingMailStatus: (student.onboardingMailStatus as EnrollStudentForm['onboardingMailStatus'] | undefined) ?? 'pending',
    phone: student.phone ?? '',
    programNames: student.programs && student.programs.length > 0 ? student.programs : student.programName ? student.programName.split(',').map((item) => item.trim()).filter(Boolean) : [],
    sendInvite: false,
    slot: student.slot ?? '',
    studentId: student.studentId ?? '',
    waGroup: student.waGroup ?? ''
  };
}

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
  const derivedSlot = deriveSlotFromSelectedCohorts(selectedCohorts);
  const displayedSlot = derivedSlot || form.slot || '';

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

    const email = form.email.trim();
    const altEmail = form.altEmail.trim();
    const fullName = form.fullName.trim();

    if (!fullName) {
      setError('Student full name is required.');
      return;
    }
    if (!email) {
      setError('Student email is required.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Student email is invalid.');
      return;
    }
    if (altEmail && !isValidEmail(altEmail)) {
      setError('Alternative email is invalid.');
      return;
    }

    const selectedProgramRecords = programOptions.filter((program) => form.programNames.includes(program.name));
    const payload: AdminStudentWritePayload = {
      active: form.active === 'yes',
      altEmail: altEmail || undefined,
      cohortIds: selectedCohorts.map((cohort) => cohort.id),
      cohortNames: form.cohortNames,
      collegeName: form.collegeName.trim() || undefined,
      email,
      fullName,
      onboardingMailStatus: form.onboardingMailStatus,
      phone: form.phone.trim() || undefined,
      programKeys: selectedProgramRecords.map((program) => program.programKey),
      programNames: form.programNames,
      sendInvite: form.sendInvite,
      slot: derivedSlot || form.slot.trim() || undefined,
      studentId: form.studentId.trim() || undefined,
      waGroup: form.waGroup.trim() || undefined
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
              <input disabled readOnly value={displayedSlot} placeholder="Auto from selected cohort start date" type="text" />
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
              <input min={1} max={1000} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value))} type="number" />
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

function ImportPreviewModal({
  cohortOptions,
  error,
  existingEmails,
  importStudents,
  onClose,
  onConfirm,
  onDownloadTemplate,
  onFile,
  preview,
  result,
  setPreview,
  programOptions,
  uploading
}: {
  cohortOptions: AdminCohort[];
  error: string | null;
  existingEmails: Set<string>;
  importStudents: ReturnType<typeof useImportAdminStudents>;
  onClose: () => void;
  onDownloadTemplate: () => Promise<void> | void;
  onConfirm: (assignmentMode: StudentImportAssignmentMode) => Promise<void>;
  onFile: (file: File) => Promise<void>;
  preview: StudentImportPreview | null;
  programOptions: AdminProgram[];
  result: AdminStudentImportRowResult[] | null;
  setPreview: (updater: (current: StudentImportPreview | null) => StudentImportPreview | null) => void;
  uploading: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<StudentImportPreviewFilter>('all');
  const [importAssignmentMode, setImportAssignmentMode] = useState<StudentImportAssignmentMode>('add');
  const [selectedRowNumbers, setSelectedRowNumbers] = useState<number[]>([]);
  const [bulkCohortNames, setBulkCohortNames] = useState<string[]>([]);
  const [bulkProgramNames, setBulkProgramNames] = useState<string[]>([]);
  const validRows = preview?.rows.filter((row) => row.errors.length === 0) ?? [];
  const invalidRows = preview?.rows.filter((row) => row.errors.length > 0) ?? [];
  const previewRows = useMemo(() => preview?.rows ?? [], [preview?.rows]);
  const cohortByName = useMemo(() => new Map(cohortOptions.map((cohort) => [cohort.name.toLowerCase(), cohort])), [cohortOptions]);
  const programByName = useMemo(() => new Map(programOptions.flatMap((program) => [[program.name.toLowerCase(), program], [program.programKey.toLowerCase(), program]] as const)), [programOptions]);
  const cohortPickerOptions = useMemo(() => cohortOptions.map((cohort) => ({ id: cohort.id, label: cohort.name, value: cohort.name })), [cohortOptions]);
  const programPickerOptions = useMemo(() => programOptions.map((program) => ({ id: program.id, label: program.name, value: program.name })), [programOptions]);
  const filteredRows = useMemo(
    () =>
      previewRows.filter((row) => {
        if (previewFilter === 'errors') return row.errors.length > 0;
        if (previewFilter === 'new') return !row.existingStudent;
        if (previewFilter === 'existing') return row.existingStudent;
        return true;
      }),
    [previewFilter, previewRows]
  );
  const visibleRows = filteredRows.slice(0, 100);
  const selectedRowSet = useMemo(() => new Set(selectedRowNumbers), [selectedRowNumbers]);
  const visibleSelectedCount = visibleRows.filter((row) => selectedRowSet.has(row.rowNumber)).length;

  useEffect(() => {
    setSelectedRowNumbers((current) => {
      const next = current.filter((rowNumber) => previewRows.some((row) => row.rowNumber === rowNumber));
      return next.length === current.length ? current : next;
    });
  }, [previewRows]);

  function recalculateRows(rows: StudentImportPreviewRow[]) {
    const emailCounts = rows.reduce<Map<string, number>>((counts, row) => {
      const email = row.payload.email.trim().toLowerCase();
      if (email) counts.set(email, (counts.get(email) ?? 0) + 1);
      return counts;
    }, new Map());

    return rows.map((row) => {
      const email = row.payload.email.trim().toLowerCase();
      const existingStudent = existingEmails.has(email);
      return {
        ...row,
        errors: validateImportPayload(row.payload, cohortByName, programByName, Boolean(email && (emailCounts.get(email) ?? 0) > 1)),
        existingStudent,
        sendPortalInvite: existingStudent ? false : row.sendPortalInvite
      };
    });
  }

  function updateRow(rowNumber: number, update: (row: StudentImportPreviewRow) => StudentImportPreviewRow) {
    setPreview((current) => (current ? { ...current, rows: recalculateRows(current.rows.map((row) => (row.rowNumber === rowNumber ? update(row) : row))) } : current));
  }

  function updatePayload(rowNumber: number, patch: Partial<AdminStudentWritePayload>) {
    updateRow(rowNumber, (row) => ({ ...row, payload: { ...row.payload, ...patch } }));
  }

  function toggleImportRow(rowNumber: number) {
    setSelectedRowNumbers((current) => (current.includes(rowNumber) ? current.filter((item) => item !== rowNumber) : [...current, rowNumber]));
  }

  function toggleVisibleImportRows() {
    const visibleRowNumbers = visibleRows.map((row) => row.rowNumber);
    const allVisibleSelected = visibleRowNumbers.length > 0 && visibleRowNumbers.every((rowNumber) => selectedRowSet.has(rowNumber));
    setSelectedRowNumbers((current) =>
      allVisibleSelected
        ? current.filter((rowNumber) => !visibleRowNumbers.includes(rowNumber))
        : Array.from(new Set([...current, ...visibleRowNumbers]))
    );
  }

  function applyBulkImportAssignments() {
    if (selectedRowNumbers.length === 0) return;
    const selectedCohorts = cohortOptions.filter((cohort) => bulkCohortNames.includes(cohort.name));
    const selectedPrograms = programOptions.filter((program) => bulkProgramNames.includes(program.name));
    const derivedSlot = deriveSlotFromSelectedCohorts(selectedCohorts);
    setPreview((current) => {
      if (!current) return current;
      const nextRows = current.rows.map((row) => {
        if (!selectedRowNumbers.includes(row.rowNumber)) return row;
        return {
          ...row,
          payload: {
            ...row.payload,
            ...(bulkCohortNames.length > 0
              ? {
                cohortIds: selectedCohorts.map((cohort) => cohort.id),
                  cohortNames: bulkCohortNames,
                  slot: derivedSlot || undefined
                }
              : {}),
            ...(bulkProgramNames.length > 0
              ? {
                  programKeys: selectedPrograms.map((program) => program.programKey),
                  programNames: bulkProgramNames
                }
              : {})
          }
        };
      });
      return { ...current, rows: recalculateRows(nextRows) };
    });
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) await onFile(file);
  }

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="student-import-title" aria-modal="true" className="student-modal student-import-modal" role="dialog">
        <header className="student-modal__header">
          <div>
            <span className="modal-eyebrow">Student Import</span>
            <h2 id="student-import-title">{preview ? preview.fileName : 'Upload students'}</h2>
          </div>
          <button aria-label="Close import preview" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={26} />
          </button>
        </header>
        <div className="student-modal__body">
          {!preview ? (
            <div className="student-import-upload">
              <button className="segmented-button" onClick={() => void onDownloadTemplate()} type="button">
                <Download size={16} />
                Download Excel Template
              </button>
              <label className="student-import-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event)}>
                <FileUp size={32} />
                <strong>{uploading ? 'Reading file...' : 'Drop Excel or CSV file here'}</strong>
                <span>Supported formats: .xlsx and .csv</span>
                <input accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={uploading} onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void onFile(file);
                }} type="file" />
              </label>
              {error ? <div className="form-banner form-banner--error">{error}</div> : null}
            </div>
          ) : (
            <>
              <div className="student-import-summary">
                <DetailField label="Ready to import" value={String(validRows.length)} />
                <DetailField label="Needs review" value={String(invalidRows.length)} />
                <DetailField label="Total rows" value={String(preview.rows.length)} />
              </div>
              <div className="student-import-modebar">
                <div>
                  <strong>{isEditing ? 'Edit mode' : 'Review mode'}</strong>
                  <span>{isEditing ? 'Update missing details, cohort tags, program tags, and email actions before import.' : 'Review detected rows first. Switch to edit mode only where corrections are needed.'}</span>
                </div>
                <button className="segmented-button" onClick={() => setIsEditing((current) => !current)} type="button">
                  {isEditing ? 'Back to Review' : 'Edit Rows'}
                </button>
              </div>
              <div className="student-import-assignmentbar" aria-label="Existing student assignment behavior">
                <div>
                  <strong>Existing student cohort/program behavior</strong>
                  <span>{importAssignmentMode === 'add' ? 'New selections will be added to existing cohorts/programs. Existing access stays untouched.' : 'Existing cohorts/programs will be replaced by the selections in this import.'}</span>
                </div>
                <div className="student-import-assignmentbar__actions" role="group" aria-label="Choose import assignment mode">
                  <button className={`segmented-button ${importAssignmentMode === 'add' ? 'segmented-button--active' : ''}`} onClick={() => setImportAssignmentMode('add')} type="button">
                    Add to existing
                  </button>
                  <button className={`segmented-button ${importAssignmentMode === 'replace' ? 'segmented-button--active' : ''}`} onClick={() => setImportAssignmentMode('replace')} type="button">
                    Replace existing
                  </button>
                </div>
              </div>
              <div className="student-import-workbar" aria-label="Import preview filters and bulk actions">
                <div className="student-import-filter-tabs" role="group" aria-label="Filter import rows">
                  {([
                    ['all', `All (${previewRows.length})`],
                    ['errors', `Errors (${invalidRows.length})`],
                    ['new', `New (${previewRows.filter((row) => !row.existingStudent).length})`],
                    ['existing', `Existing (${previewRows.filter((row) => row.existingStudent).length})`]
                  ] as Array<[StudentImportPreviewFilter, string]>).map(([value, label]) => (
                    <button key={value} className={`segmented-button ${previewFilter === value ? 'segmented-button--active' : ''}`} onClick={() => setPreviewFilter(value)} type="button">
                      {label}
                    </button>
                  ))}
                </div>
                <div className="student-import-visible-note">
                  Showing {visibleRows.length} of {filteredRows.length} matching rows. Import will use all {validRows.length} valid rows.
                </div>
              </div>
              {isEditing ? (
                <div className="student-import-bulkbar" aria-label="Bulk apply import tags">
                  <div>
                    <strong>{selectedRowNumbers.length} selected</strong>
                    <span>Select rows, choose cohorts/programs, then apply to those rows.</span>
                  </div>
                  <StudentImportMultiSelect label="bulk cohorts" options={cohortPickerOptions} selected={bulkCohortNames} onChange={setBulkCohortNames} />
                  <StudentImportMultiSelect label="bulk programs" options={programPickerOptions} selected={bulkProgramNames} onChange={setBulkProgramNames} />
                  <button className="segmented-button segmented-button--active" disabled={selectedRowNumbers.length === 0 || (bulkCohortNames.length === 0 && bulkProgramNames.length === 0)} onClick={applyBulkImportAssignments} type="button">
                    Apply to Selected
                  </button>
                </div>
              ) : null}
              <div className="student-import-table-wrap">
                <table className="data-table student-import-table student-import-edit-table">
                  <colgroup>
                    <col className="student-import-col--select" />
                    <col className="student-import-col--row" />
                    <col className="student-import-col--student" />
                    <col className="student-import-col--email" />
                    <col className="student-import-col--cohorts" />
                    <col className="student-import-col--programs" />
                    <col className="student-import-col--invite" />
                    <col className="student-import-col--onboarding" />
                    <col className="student-import-col--status" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">
                        <button className="admin-student-check" onClick={toggleVisibleImportRows} type="button" aria-label="Select visible import rows">
                          {visibleRows.length > 0 && visibleSelectedCount === visibleRows.length ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </th>
                      <th scope="col">Row</th>
                      <th scope="col">Student</th>
                      <th scope="col">Email</th>
                      <th scope="col">Cohorts</th>
                      <th scope="col">Programs</th>
                      <th scope="col">Invite</th>
                      <th scope="col">Onboarding</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.rowNumber} className={row.errors.length > 0 ? 'student-import-row--invalid' : undefined}>
                        <td>
                          <button className="admin-student-check" onClick={() => toggleImportRow(row.rowNumber)} type="button" aria-label={`Select import row ${row.rowNumber}`}>
                            {selectedRowSet.has(row.rowNumber) ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>
                        <td>{row.rowNumber}</td>
                        <td>
                          {isEditing ? (
                            <>
                              <input value={row.payload.fullName} onChange={(event) => updatePayload(row.rowNumber, { fullName: event.target.value })} placeholder="Full name" type="text" />
                              <input value={row.payload.studentId ?? ''} onChange={(event) => updatePayload(row.rowNumber, { studentId: event.target.value || undefined })} placeholder="Student ID" type="text" />
                            </>
                          ) : (
                            <div className="student-import-readonly">
                              <strong>{formatValue(row.payload.fullName)}</strong>
                              <span>{formatValue(row.payload.studentId)}</span>
                            </div>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <>
                              <input value={row.payload.email} onChange={(event) => updatePayload(row.rowNumber, { email: event.target.value.toLowerCase() })} placeholder="Email" type="email" />
                              <input value={row.payload.altEmail ?? ''} onChange={(event) => updatePayload(row.rowNumber, { altEmail: event.target.value || undefined })} placeholder="Alt email" type="email" />
                            </>
                          ) : (
                            <div className="student-import-readonly">
                              <strong>{formatValue(row.payload.email)}</strong>
                              <span>{formatValue(row.payload.altEmail)}</span>
                            </div>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <StudentImportMultiSelect
                              label="cohorts"
                              options={cohortPickerOptions}
                              selected={row.payload.cohortNames ?? []}
                              onChange={(cohortNames) => {
                              const selectedCohorts = cohortOptions.filter((cohort) => cohortNames.includes(cohort.name));
                              updatePayload(row.rowNumber, { cohortIds: selectedCohorts.map((cohort) => cohort.id), cohortNames, slot: deriveSlotFromSelectedCohorts(selectedCohorts) || undefined });
                            }}
                            />
                          ) : (
                            <span className="student-import-readonly-list">{formatList(row.payload.cohortNames)}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <StudentImportMultiSelect
                              label="programs"
                              options={programPickerOptions}
                              selected={row.payload.programNames ?? []}
                              onChange={(programNames) => {
                              const selectedPrograms = programOptions.filter((program) => programNames.includes(program.name));
                              updatePayload(row.rowNumber, { programKeys: selectedPrograms.map((program) => program.programKey), programNames });
                            }}
                            />
                          ) : (
                            <span className="student-import-readonly-list">{formatList(row.payload.programNames)}</span>
                          )}
                        </td>
                        <td>
                          <label className="student-import-checkbox">
                            <input
                              checked={row.sendPortalInvite}
                              disabled={!isEditing || row.existingStudent}
                              onChange={(event) => updateRow(row.rowNumber, (current) => ({ ...current, sendPortalInvite: event.target.checked }))}
                              type="checkbox"
                            />
                            <span>{row.existingStudent ? 'Existing' : 'Send'}</span>
                          </label>
                        </td>
                        <td>
                          <label className="student-import-checkbox">
                            <input checked={row.sendOnboardingMail} disabled={!isEditing} onChange={(event) => updateRow(row.rowNumber, (current) => ({ ...current, sendOnboardingMail: event.target.checked }))} type="checkbox" />
                            <span>Send</span>
                          </label>
                        </td>
                        <td>
                          {row.errors.length > 0 ? (
                            <div className="student-import-errors">
                              {row.errors.map((item) => (
                                <span key={item}>{item}</span>
                              ))}
                            </div>
                          ) : (
                            <StatusBadge tone="safe">Ready</StatusBadge>
                          )}
                        </td>
                      </tr>
                    ))}
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <div className="student-import-empty">No rows match this preview filter.</div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {result ? (
            <section className="student-import-results" aria-label="Import results">
              <strong>Import result</strong>
              {result.slice(0, 100).map((row) => (
                <p key={`${row.rowNumber}-${row.email ?? 'row'}`}>
                  Row {row.rowNumber}: {row.status === 'success' ? row.action : row.error}
                </p>
              ))}
            </section>
          ) : null}
        </div>
        <footer className="student-modal__footer enroll-student-modal__footer">
          <button className="segmented-button" onClick={onClose} type="button">
            Close
          </button>
          {preview ? (
            <button className="segmented-button segmented-button--active" disabled={validRows.length === 0 || importStudents.isPending} onClick={() => void onConfirm(importAssignmentMode)} type="button">
              {importStudents.isPending ? 'Importing...' : `Import ${validRows.length} Rows`}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function BulkAssignModal({
  cohortOptions,
  form,
  onClose,
  onSubmit,
  programOptions,
  selectedCount,
  setForm,
  submitting
}: {
  cohortOptions: AdminCohort[];
  form: BulkAssignForm;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  programOptions: AdminProgram[];
  selectedCount: number;
  setForm: (updater: (current: BulkAssignForm) => BulkAssignForm) => void;
  submitting: boolean;
}) {
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

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="bulk-assign-title" aria-modal="true" className="student-modal" role="dialog">
        <header className="student-modal__header">
          <div>
            <span className="modal-eyebrow">Bulk assignment</span>
            <h2 id="bulk-assign-title">Assign access to {selectedCount} students</h2>
          </div>
          <button aria-label="Close bulk assignment" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={26} />
          </button>
        </header>
        <div className="student-modal__body">
          <label className="student-bulk-mode">
            <span>Assignment mode</span>
            <select value={form.assignmentMode} onChange={(event) => setForm((current) => ({ ...current, assignmentMode: event.target.value as BulkAssignForm['assignmentMode'] }))}>
              <option value="add">Add to existing access</option>
              <option value="replace">Replace existing access</option>
            </select>
            <small>{form.assignmentMode === 'replace' ? 'Selected students will keep only the cohorts/programs chosen below.' : 'Selected cohorts/programs will be added without removing existing access.'}</small>
          </label>
          <div className="student-bulk-picker-grid">
            <section>
              <strong>Cohorts to add</strong>
              <div className="enroll-picker-list enroll-picker-list--static">
                {cohortOptions.map((cohort) => (
                  <label className="enroll-picker-row" key={cohort.id}>
                    <input checked={form.cohortNames.includes(cohort.name)} onChange={() => toggleCohort(cohort.name)} type="checkbox" />
                    <strong>{cohort.name}</strong>
                    <span>{cohort.status.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </section>
            <section>
              <strong>Programs to add</strong>
              <div className="enroll-picker-list enroll-picker-list--static">
                {programOptions.map((program) => (
                  <label className="enroll-picker-row" key={program.id}>
                    <input checked={form.programNames.includes(program.name)} onChange={() => toggleProgram(program.name)} type="checkbox" />
                    <strong>{program.name}</strong>
                    <span>{program.programKey}</span>
                  </label>
                ))}
              </div>
            </section>
          </div>
        </div>
        <footer className="student-modal__footer enroll-student-modal__footer">
          <button className="segmented-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="segmented-button segmented-button--active" disabled={submitting || (form.cohortNames.length === 0 && form.programNames.length === 0)} onClick={() => void onSubmit()} type="button">
            {submitting ? 'Assigning...' : 'Assign Selected'}
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
  const programKey = searchParams.get('programKey')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<AdminStudent | null>(null);
  const [attemptStudent, setAttemptStudent] = useState<AdminStudent | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStudentStatusChange | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<StudentImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResultRows, setImportResultRows] = useState<AdminStudentImportRowResult[] | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportParsing, setIsImportParsing] = useState(false);
  const [importExistingEmails, setImportExistingEmails] = useState<Set<string>>(new Set());
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkAssignForm, setBulkAssignForm] = useState<BulkAssignForm>({ assignmentMode: 'add', cohortNames: [], programNames: [] });

  const studentsQuery = useAdminStudents({ page, programKey, search, status, cohortName });
  const exportStudents = useExportAdminStudents();
  const saveStudent = useSaveAdminStudent();
  const updateStudent = useUpdateAdminStudent();
  const updateStudentStatus = useUpdateAdminStudentStatus();
  const importStudents = useImportAdminStudents();
  const bulkUpdateStudents = useBulkUpdateAdminStudents();
  const backfillAuthLinks = useBackfillAdminStudentAuthLinks();
  const resendStudentInvite = useResendAdminStudentInvite();
  const inviteHealthQuery = useAdminStudentInviteHealth();
  const auditLogsQuery = useAdminStudentAuditLogs();
  const programsQuery = useAdminPrograms({ limit: 100, page: 1, status: 'all' });
  const cohortsPageOneQuery = useAdminCohorts({ limit: 100, page: 1, status: 'all' });
  const cohortsPageTwoQuery = useAdminCohorts({ limit: 100, page: 2, status: 'all' });
  const cohortsPageThreeQuery = useAdminCohorts({ limit: 100, page: 3, status: 'all' });
  const data = studentsQuery.data;
  const pageStudents = data?.items ?? [];
  const authStatusesQuery = useAdminStudentAuthStatuses(pageStudents.map((student) => ({ email: student.email, id: student.id })));
  const authStatusByEmail = useMemo(() => {
    const statuses = new Map<string, AdminStudentAuthStatus>();
    authStatusesQuery.data?.statuses.forEach((item) => statuses.set(item.email.toLowerCase(), item));
    return statuses;
  }, [authStatusesQuery.data?.statuses]);
  const totalPages = data?.totalPages ?? 1;
  const cohortOptions = useMemo(() => {
    const values = new Set<string>();
    [cohortsPageOneQuery.data, cohortsPageTwoQuery.data, cohortsPageThreeQuery.data].forEach((pageData) => {
      pageData?.items.forEach((cohort) => values.add(cohort.name));
    });
    data?.items.forEach((student) => {
      studentCohortNames(student).forEach((cohortName) => values.add(cohortName));
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
  const selectedStudents = useMemo(() => pageStudents.filter((student) => selectedStudentIds.includes(student.id)), [pageStudents, selectedStudentIds]);
  const selectedCount = selectedStudentIds.length;
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    setSelectedStudentIds([]);
  }, [page, search, status, cohortName, programKey]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return undefined;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParamsKey);
      next.set('page', '1');
      if (nextSearch) next.set('search', nextSearch);
      else next.delete('search');
      setSearchParams(next, { replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search, searchInput, searchParamsKey, setSearchParams]);

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

  function handleProgramChange(nextProgramKey: string) {
    updateParams({ programKey: nextProgramKey === 'all' ? undefined : nextProgramKey });
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

  async function confirmToggleStudent() {
    if (!pendingStatusChange) return;
    const { student } = pendingStatusChange;
    try {
      await updateStudentStatus.mutateAsync({ active: !student.active, studentId: student.id });
      setPendingStatusChange(null);
      setActionMessage(student.active ? 'Student deactivated.' : 'Student reactivated.');
    } catch (error) {
      setActionMessage(readableError(error, 'Student status could not be updated.'));
    }
  }

  function downloadStudentsCsv(students: AdminStudent[], fileName: string) {
    if (!students.length) return;
    const headers = ['studentId', 'fullName', 'email', 'altEmail', 'phone', 'collegeName', 'cohortName', 'slot', 'programs', 'waGroup', 'onboardingMailStatus', 'active'];
    const lines = [
      headers.join(','),
      ...students.map((student) =>
        [
          student.studentId,
          student.fullName,
          student.email,
          student.altEmail,
          student.phone,
          student.collegeName,
          formatList(studentCohortNames(student), student.cohortName),
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
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadImportTemplate() {
    try {
      const { default: writeXlsxFile } = await import('write-excel-file/browser');
      const studentRows: SheetData = [
        studentImportHeaders,
        ['STU-1001', 'Example Student', 'student@example.com', '', '+91 90000 00000', 'Example College', 'Cohort A|Cohort B', 'Program A|Program B', 'WA Group Name', 'pending', 'true']
      ];
      const cohortRows: SheetData = [
        ['Cohort Name', 'Cohort ID', 'Start Date', 'Derived Slot', 'Status'],
        ...cohortRecords.map((cohort) => [cohort.name, cohort.id, cohort.startDate ?? '', deriveSlotFromCohortStartDate(cohort), cohort.status])
      ];
      const programRows: SheetData = [['Program Name', 'Program Key', 'Status'], ...programRecords.map((program) => [program.name, program.programKey, program.status])];
      const sheets: Array<Sheet<Blob>> = [
        { data: studentRows, sheet: 'Students' },
        { data: cohortRows, sheet: 'Cohorts' },
        { data: programRows, sheet: 'Programs' }
      ];
      const blob = await writeXlsxFile(sheets, { fontFamily: 'Arial', fontSize: 12 }).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'students-import-template.xlsx';
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 0);
      setActionMessage('Excel import template downloaded.');
    } catch (error) {
      setImportError(readableError(error, 'Excel template could not be downloaded.'));
    }
  }

  async function handleExportCsv() {
    try {
      const result = await exportStudents.mutateAsync({ cohortName, programKey, search, status });
      downloadStudentsCsv(result.items, `students-filtered-${new Date().toISOString().slice(0, 10)}.csv`);
      setActionMessage(`Exported ${result.items.length} filtered students.`);
    } catch (error) {
      setActionMessage(readableError(error, 'Filtered export failed.'));
    }
  }

  function handleExportSelectedCsv() {
    downloadStudentsCsv(selectedStudents, `students-selected-${new Date().toISOString().slice(0, 10)}.csv`);
    setActionMessage(`Exported ${selectedStudents.length} selected students.`);
  }

  function openImportModal() {
    setImportError(null);
    setImportPreview(null);
    setImportResultRows(null);
    setIsImportModalOpen(true);
  }

  function closeImportModal() {
    setIsImportModalOpen(false);
    setImportError(null);
    setImportPreview(null);
    setImportResultRows(null);
    setIsImportParsing(false);
    setImportExistingEmails(new Set());
  }

  async function handleImportFile(file: File) {
    try {
      setImportError(null);
      setImportResultRows(null);
      setIsImportParsing(true);
      const rows = await readImportRows(file);
      const [headers, ...bodyRows] = rows;
      if (!headers || bodyRows.length === 0) {
        setImportError('No student rows found. Use the template format and upload again.');
        return;
      }

      const cohortByName = new Map(cohortRecords.map((cohort) => [cohort.name.toLowerCase(), cohort]));
      const programByKeyOrName = new Map(programRecords.flatMap((program) => [[program.name.toLowerCase(), program], [program.programKey.toLowerCase(), program]] as const));
      const existingResult = await exportStudents.mutateAsync({ status: 'all' });
      const existingEmails = new Set(existingResult.items.map((student) => student.email.trim().toLowerCase()).filter(Boolean));
      setImportExistingEmails(existingEmails);

      const emailCounts = bodyRows.reduce<Map<string, number>>((counts, row) => {
        const email = buildImportPayloadFromRow(row, headers, cohortByName, programByKeyOrName).email.trim().toLowerCase();
        if (email) counts.set(email, (counts.get(email) ?? 0) + 1);
        return counts;
      }, new Map());

      const previewRows = bodyRows.map((row, index) => {
        const payload = buildImportPayloadFromRow(row, headers, cohortByName, programByKeyOrName);
        const email = payload.email.trim().toLowerCase();
        const existingStudent = existingEmails.has(email);
        return {
          errors: validateImportPayload(payload, cohortByName, programByKeyOrName, Boolean(email && (emailCounts.get(email) ?? 0) > 1)),
          existingStudent,
          payload,
          rowNumber: index + 2,
          sendOnboardingMail: true,
          sendPortalInvite: !existingStudent
        };
      });

      if (previewRows.length === 0) {
        setImportError('No readable student rows found.');
        return;
      }

      setImportPreview({ fileName: file.name, rows: previewRows });
    } catch (error) {
      setImportError(readableError(error, 'Import file could not be read.'));
    } finally {
      setIsImportParsing(false);
    }
  }

  async function confirmImportStudents(assignmentMode: StudentImportAssignmentMode = 'add') {
    if (!importPreview) return;
    const payload = importPreview.rows
      .filter((row) => row.errors.length === 0)
      .map((row) => ({
        ...row.payload,
        assignmentMode,
        sendInvite: row.sendPortalInvite && !row.existingStudent,
        sendOnboardingMail: row.sendOnboardingMail
      }));
    if (payload.length === 0) {
      setActionMessage('Student import skipped: preview has no valid rows.');
      return;
    }
    const result = await importStudents.mutateAsync(payload);
    setImportResultRows(result.rows ?? null);
    setActionMessage(`Student import finished: ${result.created} created, ${result.updated} updated, ${result.failed} failed.`);
  }

  function toggleSelectedStudent(studentId: string) {
    setSelectedStudentIds((current) => (current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]));
  }

  function toggleCurrentPageSelection() {
    const pageIds = pageStudents.map((student) => student.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedStudentIds.includes(id));
    setSelectedStudentIds(allSelected ? selectedStudentIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedStudentIds, ...pageIds])));
  }

  async function runBulkUpdate(payload: Omit<AdminStudentsBulkPayload, 'studentIds'>, message: string) {
    if (selectedStudentIds.length === 0) return;
    try {
      const result = await bulkUpdateStudents.mutateAsync({ ...payload, studentIds: selectedStudentIds });
      setActionMessage(`${message}: ${result.updated} updated${result.failed ? `, ${result.failed} failed` : ''}.`);
      setSelectedStudentIds([]);
    } catch (error) {
      setActionMessage(readableError(error, 'Bulk action failed.'));
    }
  }

  async function handleBulkAssign() {
    const selectedPrograms = programRecords.filter((program) => bulkAssignForm.programNames.includes(program.name));
    const selectedCohorts = cohortRecords.filter((cohort) => bulkAssignForm.cohortNames.includes(cohort.name));
    await runBulkUpdate(
      {
        cohortIds: selectedCohorts.map((cohort) => cohort.id),
        cohortNames: bulkAssignForm.cohortNames,
        programKeys: selectedPrograms.map((program) => program.programKey),
        programNames: bulkAssignForm.programNames,
        assignmentMode: bulkAssignForm.assignmentMode
      },
      bulkAssignForm.assignmentMode === 'replace' ? 'Bulk replacement finished' : 'Bulk assignment finished'
    );
    setBulkAssignForm({ assignmentMode: 'add', cohortNames: [], programNames: [] });
    setIsBulkAssignOpen(false);
  }

  async function handleBackfillAuthLinks() {
    if (selectedStudentIds.length === 0) return;
    try {
      const result = await backfillAuthLinks.mutateAsync(selectedStudentIds);
      setActionMessage(`Auth link check finished: ${result.linked} linked, ${result.skipped} skipped${result.failed ? `, ${result.failed} failed` : ''}.`);
      setSelectedStudentIds([]);
    } catch (error) {
      setActionMessage(readableError(error, 'Auth account linking failed.'));
    }
  }

  async function handleResendInvite(student: AdminStudent) {
    try {
      await resendStudentInvite.mutateAsync(student.id);
      setActionMessage(`Password setup invite queued for ${student.email}.`);
    } catch (error) {
      setActionMessage(readableError(error, 'Invite could not be queued.'));
    }
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
    <div className="page-stack admin-students-page">
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
        <select aria-label="Filter by program" className="admin-student-select" value={programKey || 'all'} onChange={(event) => handleProgramChange(event.target.value)}>
          <option value="all">All Programs</option>
          {programRecords.map((program) => (
            <option key={program.id} value={program.programKey}>
              {program.name}
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
          <button className="segmented-button" disabled={!data?.items.length || exportStudents.isPending} onClick={() => void handleExportCsv()} type="button">
            <Download size={16} />
            {exportStudents.isPending ? 'Exporting...' : 'Export Filtered'}
          </button>
          <button className="segmented-button" disabled={importStudents.isPending || isImportParsing} onClick={openImportModal} type="button">
            <FileUp size={16} />
            Import
          </button>
          <button className="segmented-button segmented-button--active" onClick={() => setIsEnrollModalOpen(true)} type="button">
            <Plus size={16} />
            Enroll Student
          </button>
        </div>
      </section>

      {actionMessage ? (
        <div className={`admin-student-toast ${isFailureMessage(actionMessage) ? 'admin-student-toast--error' : 'admin-student-toast--success'}`} role="status">
          <strong>{isFailureMessage(actionMessage) ? 'Action failed' : 'Action complete'}</strong>
          <span>{actionMessage}</span>
          <button aria-label="Dismiss message" onClick={() => setActionMessage(null)} type="button">
            <X size={16} />
          </button>
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <section className="admin-student-bulkbar" aria-label="Bulk student actions">
          <strong>{selectedCount} selected</strong>
          <button className="segmented-button" disabled={bulkUpdateStudents.isPending} onClick={() => void runBulkUpdate({ active: true }, 'Bulk activation finished')} type="button">
            <UserCheck size={16} />
            Activate
          </button>
          <button className="segmented-button" disabled={bulkUpdateStudents.isPending} onClick={() => void runBulkUpdate({ active: false }, 'Bulk deactivation finished')} type="button">
            Deactivate
          </button>
          <button className="segmented-button" disabled={bulkUpdateStudents.isPending} onClick={() => setIsBulkAssignOpen(true)} type="button">
            <Users size={16} />
            Assign
          </button>
          <button className="segmented-button" disabled={bulkUpdateStudents.isPending} onClick={() => void runBulkUpdate({ resendInvite: true }, 'Invite resend finished')} type="button">
            <Mail size={16} />
            Resend invites
          </button>
          <button className="segmented-button" disabled={backfillAuthLinks.isPending} onClick={() => void handleBackfillAuthLinks()} type="button">
            <Link2 size={16} />
            Link auth
          </button>
          <button className="segmented-button" onClick={handleExportSelectedCsv} type="button">
            <Download size={16} />
            Export selected
          </button>
          <button className="segmented-button" onClick={() => setSelectedStudentIds([])} type="button">
            Clear
          </button>
        </section>
      ) : null}

      {data && data.items.length > 0 ? (
        <section className="admin-student-table-card" aria-label="Student records">
          <div className="data-table-wrap admin-student-table-wrap">
            <table className="data-table admin-student-table">
              <colgroup>
                <col className="admin-student-col--select" />
                <col className="admin-student-col--name" />
                <col className="admin-student-col--access" />
                <col className="admin-student-col--auth" />
                <col className="admin-student-col--status" />
                <col className="admin-student-col--actions" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">
                    <button className="admin-student-check" onClick={toggleCurrentPageSelection} type="button" aria-label="Select current page">
                      {pageStudents.length > 0 && pageStudents.every((student) => selectedStudentIds.includes(student.id)) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </th>
                  <th scope="col">Student</th>
                  <th scope="col">Access</th>
                  <th scope="col">Auth & Invite</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((student) => {
                  const authStatus = authStatusByEmail.get(student.email.toLowerCase());
                  return (
                  <tr key={student.id}>
                    <td>
                      <button className="admin-student-check" onClick={() => toggleSelectedStudent(student.id)} type="button" aria-label={`Select ${student.fullName}`}>
                        {selectedStudentIds.includes(student.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </td>
                    <td>
                      <div className="admin-student-name">
                        <span>{avatarLabel(student.fullName)}</span>
                        <div>
                          <strong>{formatValue(student.fullName)}</strong>
                          <small>{formatValue(student.email)}</small>
                          <small>{formatValue(student.studentId)}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="admin-student-access-cell">
                        <span>{formatList(student.programs, student.programName)}</span>
                        <small>{formatList(studentCohortNames(student), student.cohortName)}</small>
                      </div>
                    </td>
                    <td>
                      <div className="admin-student-auth-cell">
                        <StatusBadge tone={authStatus?.authAccountExists ? 'safe' : 'warning'}>{authStatusesQuery.isError ? 'Status unavailable' : summarizeAuthStatus(authStatus)}</StatusBadge>
                        <small>Invite: {authStatusesQuery.isError ? formatValue(student.onboardingMailStatus) : summarizeInviteStatus(authStatus, student.onboardingMailStatus)}</small>
                      </div>
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
                        <button className="segmented-button" disabled={resendStudentInvite.isPending} onClick={() => void handleResendInvite(student)} type="button">
                          Invite
                        </button>
                        <button className="segmented-button" onClick={() => setAttemptStudent(student)} type="button">
                          LP Attempts
                        </button>
                        <button className="segmented-button" disabled={updateStudentStatus.isPending} onClick={() => setPendingStatusChange({ student })} type="button">
                          {student.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Admin student pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, search, status, cohortName, programKey)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, search, status, cohortName, programKey)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      <section className="admin-student-ops-panel" aria-label="Student operations health and audit">
        <div className="admin-student-ops-card">
          <div className="admin-student-ops-card__header">
            <Mail size={18} />
            <div>
              <span>Invite System</span>
              <strong>Invite delivery health</strong>
            </div>
          </div>
          <p>Tracks password setup invite queue health so admins can quickly spot stuck or failed student invite emails.</p>
          {inviteHealthQuery.isLoading ? (
            <p>Checking invite queue...</p>
          ) : inviteHealthQuery.isError ? (
            <p>Invite queue status unavailable.</p>
          ) : inviteHealthQuery.data ? (
            <dl className="admin-student-health-list">
              <div>
                <dt>Recent total</dt>
                <dd>{inviteHealthQuery.data.total}</dd>
              </div>
              <div>
                <dt>Queued</dt>
                <dd>{inviteHealthQuery.data.counts.queued ?? 0}</dd>
              </div>
              <div>
                <dt>Sent</dt>
                <dd>{inviteHealthQuery.data.counts.sent ?? 0}</dd>
              </div>
              <div>
                <dt>Failed</dt>
                <dd>{inviteHealthQuery.data.counts.failed ?? 0}</dd>
              </div>
              <div>
                <dt>Latest update</dt>
                <dd>{formatDateTime(inviteHealthQuery.data.latestAt ?? undefined)}</dd>
              </div>
              <div>
                <dt>Latest failure</dt>
                <dd>{formatValue(inviteHealthQuery.data.latestFailure)}</dd>
              </div>
            </dl>
          ) : null}
        </div>
        <div className="admin-student-ops-card">
          <div className="admin-student-ops-card__header">
            <History size={18} />
            <div>
              <span>Audit Trail</span>
              <strong>Recent access changes</strong>
            </div>
          </div>
          <p>Shows recent student profile, access, invite, and attempt-limit changes for traceability after admin actions.</p>
          {auditLogsQuery.isLoading ? (
            <p>Loading recent actions...</p>
          ) : auditLogsQuery.isError ? (
            <p>Student audit history unavailable.</p>
          ) : auditLogsQuery.data?.items.length ? (
            <div className="admin-student-audit-list">
              {auditLogsQuery.data.items.map((entry) => (
                <article key={entry.id}>
                  <strong>{formatAuditAction(entry.action)}</strong>
                  <span>{entry.actorEmail || 'System action'}</span>
                  <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                </article>
              ))}
            </div>
          ) : (
            <p>No student audit entries yet.</p>
          )}
        </div>
      </section>

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
      {isImportModalOpen ? (
        <ImportPreviewModal
          cohortOptions={cohortRecords}
          error={importError}
          existingEmails={importExistingEmails}
          importStudents={importStudents}
          onClose={closeImportModal}
          onConfirm={confirmImportStudents}
          onDownloadTemplate={handleDownloadImportTemplate}
          onFile={handleImportFile}
          preview={importPreview}
          programOptions={programRecords}
          result={importResultRows}
          setPreview={setImportPreview}
          uploading={isImportParsing}
        />
      ) : null}
      {isBulkAssignOpen ? (
        <BulkAssignModal
          cohortOptions={cohortRecords}
          form={bulkAssignForm}
          onClose={() => setIsBulkAssignOpen(false)}
          onSubmit={handleBulkAssign}
          programOptions={programRecords}
          selectedCount={selectedCount}
          setForm={setBulkAssignForm}
          submitting={bulkUpdateStudents.isPending}
        />
      ) : null}
      {pendingStatusChange ? (
        <div className="student-modal-backdrop" role="presentation">
          <section aria-labelledby="student-status-title" aria-modal="true" className="student-modal" role="dialog">
            <header className="student-modal__header">
              <h2 id="student-status-title">{pendingStatusChange.student.active ? 'Deactivate Student' : 'Reactivate Student'}</h2>
              <button aria-label="Close status confirmation" className="student-modal__icon-button" onClick={() => setPendingStatusChange(null)} type="button">
                <X size={26} />
              </button>
            </header>
            <div className="student-modal__body">
              <p>
                Confirm status change for <strong>{pendingStatusChange.student.fullName}</strong>.
              </p>
            </div>
            <footer className="student-modal__footer">
              <button className="segmented-button" onClick={() => setPendingStatusChange(null)} type="button">
                Cancel
              </button>
              <button className="segmented-button segmented-button--active" disabled={updateStudentStatus.isPending} onClick={() => void confirmToggleStudent()} type="button">
                {updateStudentStatus.isPending ? 'Saving...' : 'Confirm'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
