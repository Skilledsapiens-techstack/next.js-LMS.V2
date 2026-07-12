import { CheckSquare, ClipboardPaste, Download, Eye, FileUp, Link2, Mail, Pencil, Plus, RefreshCw, Search, Square, UserCheck, Users, X } from 'lucide-react';
import { DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Sheet, SheetData } from 'write-excel-file/browser';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { hasAdminPermission } from '../auth/adminPermissions';
import { useAdminProfile } from '../features/admin/useAdminDashboard';
import {
  AdminStudent,
  AdminStudentAuthStatus,
  AdminStudentImportRowResult,
  AdminStudentStatus,
  AdminStudentWritePayload,
  AdminStudentsBulkPayload,
  useAdminStudentAuthStatuses,
  useAdminStudentCollegeOptions,
  useAdminStudentAttemptLimit,
  useAdminStudentAccessPreview,
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
import { AdminProjectRole, useAdminProjectRoles } from '../features/admin/useAdminProjects';

const statusOptions: Array<{ label: string; value: AdminStudentStatus | 'all' }> = [
  { label: 'All Students', value: 'all' },
  { label: 'Active Students', value: 'active' },
  { label: 'Inactive Students', value: 'inactive' }
];

const educationYearOptions = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate', 'Working Professional'] as const;
const personalMentorOptions = ['Yes', 'No'] as const;
const liveProjectDurationOptions = ['2 weeks', '4 weeks', '6 weeks', '8 weeks'] as const;
const studentRowsPerPageOptions = [25, 50, 75, 100] as const;

const studentImportHeaders = ['studentId', 'fullName', 'email', 'altEmail', 'phone', 'collegeName', 'cohortNames', 'programNames', 'waGroup', 'personalmentor', 'you_are_from', 'project_start_date', 'duration', 'liveProjectRoles', 'onboardingMailStatus', 'active'];
const studentExportHeaders = ['serialNumber', ...studentImportHeaders];
const studentSortOptions = ['sequence', 'student', 'access', 'education', 'mentor', 'onboarding', 'duration', 'auth', 'status'] as const;

type StudentSortKey = (typeof studentSortOptions)[number];
type SortDirection = 'asc' | 'desc';

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parseStatus(value: string | null): AdminStudentStatus | 'all' {
  return statusOptions.some((option) => option.value === value) ? (value as AdminStudentStatus | 'all') : 'all';
}

function parseRowsPerPage(value: string | null) {
  const parsed = Number(value);
  return studentRowsPerPageOptions.some((option) => option === parsed) ? parsed : 25;
}

function parseStudentSort(value: string | null): StudentSortKey {
  return studentSortOptions.some((option) => option === value) ? (value as StudentSortKey) : 'sequence';
}

function parseSortDirection(value: string | null): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

function formatDate(value: string | undefined) {
  if (!value) return '-';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatValue(value: string | number | undefined | null, fallback = '-') {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function formatList(values: Array<string | undefined> | undefined, fallback?: string) {
  const normalized = values?.map((value) => value?.trim()).filter((value): value is string => Boolean(value)) ?? [];
  if (normalized.length > 0) return normalized.join(', ');
  return formatValue(fallback);
}

function formatRoleList(student: AdminStudent) {
  return formatList(student.liveProjectRoles, student.liveProjectRoleIds?.join(', '));
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

function buildPageLink(page: number, search: string, status: AdminStudentStatus | 'all', cohortName: string, programKey: string, limit: number, sort: StudentSortKey, direction: SortDirection) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  params.set('sort', sort);
  params.set('direction', direction);
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

function parsePastedTableRows(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (!trimmed.includes('\t')) return parseCsvRows(trimmed);
  return trimmed
    .split(/\r?\n/)
    .map((row) => row.split('\t').map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
}

function normalizedHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function looksLikeImportHeader(row: string[]) {
  const normalizedHeaders = new Set(row.map(normalizedHeader));
  const hasEmail = normalizedHeaders.has('email') || normalizedHeaders.has('emailaddress');
  return hasEmail && (normalizedHeaders.has('fullname') || normalizedHeaders.has('name'));
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

function normalizeOptionValue<TValue extends string>(value: string, options: readonly TValue[]) {
  const normalized = value.trim().toLowerCase();
  return options.find((option) => option.toLowerCase() === normalized);
}

function normalizeYesNo(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['yes', 'y', 'true', '1'].includes(normalized)) return 'Yes';
  if (['no', 'n', 'false', '0'].includes(normalized)) return 'No';
  return normalizeOptionValue(value, personalMentorOptions);
}

function normalizeImportDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().slice(0, 10);
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
  roleByIdOrName: Map<string, AdminProjectRole>,
  duplicateEmail: boolean
) {
  const errors: string[] = [];
  const email = payload.email.trim().toLowerCase();
  if (!payload.fullName.trim()) errors.push('Full name missing');
  if (!email) errors.push('Email missing');
  else if (!isValidEmail(email)) errors.push('Email invalid');
  else if (duplicateEmail) errors.push('Duplicate email in file');
  if (payload.altEmail && !isValidEmail(payload.altEmail)) errors.push('Alt email invalid');
  if (payload.personalMentor && !personalMentorOptions.includes(payload.personalMentor as (typeof personalMentorOptions)[number])) errors.push('Opted for Personal Mentor must be Yes or No');
  if (payload.educationYear && !educationYearOptions.includes(payload.educationYear as (typeof educationYearOptions)[number])) errors.push('Education Year invalid');
  if (payload.liveProjectDuration && !liveProjectDurationOptions.includes(payload.liveProjectDuration as (typeof liveProjectDurationOptions)[number])) errors.push('Live Project Duration invalid');
  if (payload.onboardingDate && Number.isNaN(new Date(`${payload.onboardingDate}T00:00:00`).getTime())) errors.push('Onboarding Date invalid');
  const missingCohorts = (payload.cohortNames ?? []).filter((name) => !cohortByName.has(name.toLowerCase()));
  if (missingCohorts.length > 0) errors.push(`Unknown cohorts: ${missingCohorts.join(', ')}`);
  const missingPrograms = (payload.programNames ?? []).filter((name) => !programByKeyOrName.has(name.toLowerCase()));
  if (missingPrograms.length > 0) errors.push(`Unknown programs: ${missingPrograms.join(', ')}`);
  const missingRoles = (payload.liveProjectRoleIds ?? []).filter((roleId) => !roleByIdOrName.has(roleId.toLowerCase()));
  if (missingRoles.length > 0) errors.push(`Unknown live project roles: ${missingRoles.join(', ')}`);
  return errors;
}

function roleMapKey(value: string | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function buildRoleLookup(roles: AdminProjectRole[]) {
  const entries = roles.flatMap((role) => [
    [roleMapKey(role.id), role],
    [roleMapKey(role.roleId), role],
    [roleMapKey(role.name), role]
  ] as Array<[string, AdminProjectRole]>);
  return new Map(entries.filter(([key]) => Boolean(key)));
}

function buildImportPayloadFromRow(row: string[], headers: string[], cohortByName: Map<string, AdminCohort>, programByKeyOrName: Map<string, AdminProgram>, roleByIdOrName: Map<string, AdminProjectRole>) {
  const getValue = makeHeaderReader(headers);
  const cohortNames = splitImportList(getValue(row, ['cohortNames', 'cohortName', 'cohorts']));
  const programValues = splitImportList(getValue(row, ['programNames', 'programName', 'programs', 'programKeys']));
  const roleValues = splitImportList(getValue(row, ['liveProjectRoles', 'liveProjectRole', 'live project role', 'live project roles', 'projectRoles', 'projectRole', 'roleIds', 'roleId']));
  const selectedCohorts = cohortNames.map((name) => cohortByName.get(name.toLowerCase())).filter((cohort): cohort is AdminCohort => Boolean(cohort));
  const selectedPrograms = programValues.map((name) => programByKeyOrName.get(name.toLowerCase())).filter((program): program is AdminProgram => Boolean(program));
  const liveProjectRoleIds = roleValues.map((value) => {
    const role = roleByIdOrName.get(value.toLowerCase());
    return role?.roleId ?? role?.id ?? value;
  });
  const activeValue = getValue(row, ['active', 'status']).toLowerCase();
  const derivedSlot = deriveSlotFromSelectedCohorts(selectedCohorts);

  return {
    active: activeValue ? !['false', 'inactive', 'no', '0'].includes(activeValue) : true,
    altEmail: getValue(row, ['altEmail', 'alternateEmail']) || undefined,
    cohortIds: selectedCohorts.map((cohort) => cohort.id),
    cohortNames,
    collegeName: getValue(row, ['collegeName', 'college']) || undefined,
    email: getValue(row, ['email', 'emailAddress']).toLowerCase(),
    educationYear: normalizeOptionValue(getValue(row, ['you_are_from', 'educationYear', 'education year']), educationYearOptions),
    fullName: getValue(row, ['fullName', 'name']),
    liveProjectDuration: normalizeOptionValue(getValue(row, ['duration', 'liveProjectDuration', 'live project duration']), liveProjectDurationOptions),
    liveProjectRoleIds,
    onboardingMailStatus: normalizeImportStatus(getValue(row, ['onboardingMailStatus'])),
    onboardingDate: normalizeImportDate(getValue(row, ['project_start_date', 'onboardingDate', 'onboarding date'])),
    personalMentor: normalizeYesNo(getValue(row, ['personalmentor', 'personalMentor', 'optedForPersonalMentor', 'opted for personal mentor'])),
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
type StudentImportEntryMode = 'file' | 'paste';
type StudentImportProgress = {
  completed: number;
  created: number;
  failed: number;
  percent: number;
  total: number;
  updated: number;
};
type StudentImportPreviewFilter = 'all' | 'errors' | 'new' | 'existing';

const studentImportBatchSize = 10;

function summarizeAuthStatus(status: AdminStudentAuthStatus | undefined) {
  if (!status) return 'Checking';
  if (status.authAccountExists) return status.lastSignInAt ? 'Password active' : 'Account created';
  return 'No password yet';
}

function summarizeInviteStatus(status: AdminStudentAuthStatus | undefined, fallback?: string) {
  return status?.inviteStatus ?? fallback ?? 'Not queued';
}

function isFailureMessage(message: string) {
  const importSummary = message.match(/^Student import finished:\s*\d+\s+created,\s*\d+\s+updated,\s*(\d+)\s+failed\.$/i);
  if (importSummary) return Number(importSummary[1]) > 0;
  return /\b(could not|failed|invalid|unavailable|error|skipped)\b/i.test(message);
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
  metaLabel,
  onChange,
  options,
  selected
}: {
  label: string;
  metaLabel?: string;
  onChange: (values: string[]) => void;
  options: Array<{ id: string; label: string; meta?: string; value: string }>;
  selected: string[];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const selectedSet = new Set(selected);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter((option) => [option.label, option.value, option.meta].some((value) => value?.toLowerCase().includes(normalizedSearch)))
    : options;

  function toggleValue(value: string) {
    onChange(selectedSet.has(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  function removeValue(value: string) {
    onChange(selected.filter((item) => item !== value));
  }

  return (
    <details className="student-import-picker">
      <summary className="student-import-picker__selected" aria-label={`Selected ${label}`}>
        {selected.length > 0 ? (
          selected.map((item) => (
            <span key={item} className="student-import-chip">
              <span>{item}</span>
              <button
                aria-label={`Remove ${item}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeValue(item);
                }}
                type="button"
              >
                <X size={13} />
              </button>
            </span>
          ))
        ) : (
          <span className="student-import-chip student-import-chip--empty">No {label} selected</span>
        )}
      </summary>
      <div className="student-import-picker__list" aria-label={`${label} options`}>
        <label className="student-import-picker__search">
          <Search size={15} />
          <span className="sr-only">Search {label}</span>
          <input autoComplete="off" onChange={(event) => setSearchTerm(event.target.value)} placeholder={`Search ${label}`} type="search" value={searchTerm} />
        </label>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => (
            <label key={option.id} className="student-import-picker__option">
              <input checked={selectedSet.has(option.value)} onChange={() => toggleValue(option.value)} type="checkbox" />
              <span>
                <strong>{option.label}</strong>
                {option.meta ? <small>{metaLabel ? `${metaLabel}: ${option.meta}` : option.meta}</small> : null}
              </span>
            </label>
          ))
        ) : (
          <p className="student-import-picker__empty">No matching {label} found.</p>
        )}
      </div>
    </details>
  );
}

function StudentDetailsModal({ student, onClose }: { student: AdminStudent; onClose: () => void }) {
  const accessPreview = useAdminStudentAccessPreview(student.id);
  const detailRows = [
    ['Serial No.', formatValue(student.onboardingSequence)],
    ['Full Name', formatValue(student.fullName)],
    ['Email ID', formatValue(student.email)],
    ['Alt. Email', formatValue(student.altEmail)],
    ['Phone', formatValue(student.phone)],
    ['College', formatValue(student.collegeName)],
    ['Education Year', formatValue(student.educationYear)],
    ['Opted for Personal Mentor', formatValue(student.personalMentor)],
    ['Onboarding Date', formatDate(student.onboardingDate)],
    ['Live Project Duration', formatValue(student.liveProjectDuration)],
    ['Live Project Role', formatRoleList(student)],
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
  roleOptions: AdminProjectRole[];
  student?: AdminStudent;
};

type EnrollStudentForm = {
  active: 'yes' | 'no';
  altEmail: string;
  cohortNames: string[];
  collegeName: string;
  educationYear: string;
  email: string;
  fullName: string;
  liveProjectDuration: string;
  liveProjectRoleIds: string[];
  onboardingMailStatus: 'pending' | 'sent' | 'failed' | 'skipped' | 'dry-run';
  onboardingDate: string;
  personalMentor: string;
  phone: string;
  programNames: string[];
  sendOnboardingMail: boolean;
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
  educationYear: '',
  email: '',
  fullName: '',
  liveProjectDuration: '',
  liveProjectRoleIds: [],
  onboardingMailStatus: 'pending',
  onboardingDate: '',
  personalMentor: '',
  phone: '',
  programNames: [],
  sendOnboardingMail: true,
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
    educationYear: student.educationYear ?? '',
    email: student.email,
    fullName: student.fullName,
    liveProjectDuration: student.liveProjectDuration ?? '',
    liveProjectRoleIds: student.liveProjectRoleIds ?? [],
    onboardingMailStatus: (student.onboardingMailStatus as EnrollStudentForm['onboardingMailStatus'] | undefined) ?? 'pending',
    onboardingDate: student.onboardingDate ? student.onboardingDate.slice(0, 10) : '',
    personalMentor: student.personalMentor ?? '',
    phone: student.phone ?? '',
    programNames: student.programs && student.programs.length > 0 ? student.programs : student.programName ? student.programName.split(',').map((item) => item.trim()).filter(Boolean) : [],
    sendOnboardingMail: false,
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

function EnrollStudentModal({ cohortOptions, collegeOptions, mode, onClose, onSubmit, programOptions, roleOptions, student }: EnrollStudentModalProps) {
  const [form, setForm] = useState<EnrollStudentForm>(() => studentToForm(student));
  const [error, setError] = useState<string | null>(null);

  const selectedCohorts = cohortOptions.filter((cohort) => form.cohortNames.includes(cohort.name));
  const cohortPickerOptions = useMemo(() => cohortOptions.map((cohort) => ({ id: cohort.id, label: cohort.name, meta: cohort.status.toUpperCase(), value: cohort.name })), [cohortOptions]);
  const programPickerOptions = useMemo(() => programOptions.map((program) => ({ id: program.id, label: program.name, meta: program.programKey, value: program.name })), [programOptions]);
  const rolePickerOptions = useMemo(() => roleOptions.map((role) => ({ id: role.id, label: role.name, meta: [role.roleId, role.programKey].filter(Boolean).join(' · '), value: role.roleId ?? role.id })), [roleOptions]);
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
      assignmentMode: mode === 'create' ? 'add' : 'replace',
      altEmail: altEmail || undefined,
      cohortIds: selectedCohorts.map((cohort) => cohort.id),
      cohortNames: form.cohortNames,
      collegeName: form.collegeName.trim() || undefined,
      email,
      educationYear: form.educationYear || undefined,
      fullName,
      liveProjectDuration: form.liveProjectDuration || undefined,
      liveProjectRoleIds: form.liveProjectRoleIds,
      onboardingMailStatus: form.onboardingMailStatus,
      onboardingDate: form.onboardingDate || undefined,
      personalMentor: form.personalMentor || undefined,
      phone: form.phone.trim() || undefined,
      programKeys: selectedProgramRecords.map((program) => program.programKey),
      programNames: form.programNames,
      sendOnboardingMail: form.sendOnboardingMail,
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
            <label>
              <span>Education Year</span>
              <select value={form.educationYear} onChange={(event) => updateForm('educationYear', event.target.value)}>
                <option value="">Select education year</option>
                {educationYearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Opted for Personal Mentor</span>
              <select value={form.personalMentor} onChange={(event) => updateForm('personalMentor', event.target.value)}>
                <option value="">Select mentor option</option>
                {personalMentorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Onboarding Date</span>
              <input value={form.onboardingDate} onChange={(event) => updateForm('onboardingDate', event.target.value)} type="date" />
            </label>
            <label>
              <span>Live Project Duration</span>
              <select value={form.liveProjectDuration} onChange={(event) => updateForm('liveProjectDuration', event.target.value)}>
                <option value="">Select duration</option>
                {liveProjectDurationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div className="enroll-multi-field enroll-student-form__wide">
              <span>Live Project Role (optional)</span>
              <StudentImportMultiSelect
                label="live project roles"
                metaLabel="Role ID"
                onChange={(liveProjectRoleIds) => updateForm('liveProjectRoleIds', liveProjectRoleIds)}
                options={rolePickerOptions}
                selected={form.liveProjectRoleIds}
              />
            </div>

            <div className="enroll-multi-field enroll-student-form__wide">
              <span>Cohorts (select one or more)</span>
              <StudentImportMultiSelect
                label="cohorts"
                metaLabel="Status"
                onChange={(cohortNames) => updateForm('cohortNames', cohortNames)}
                options={cohortPickerOptions}
                selected={form.cohortNames}
              />
            </div>

            <div className="enroll-summary enroll-student-form__wide">{selectedCohortSummary}</div>

            <div className="enroll-multi-field enroll-student-form__wide">
              <span>Program Name (select one or more)</span>
              <StudentImportMultiSelect
                label="programs"
                metaLabel="Key"
                onChange={(programNames) => updateForm('programNames', programNames)}
                options={programPickerOptions}
                selected={form.programNames}
              />
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
              <span>Send portal invite mail</span>
            </label>
            <label className="enroll-checkbox enroll-student-form__wide">
              <input checked={form.sendOnboardingMail} onChange={(event) => updateForm('sendOnboardingMail', event.target.checked)} type="checkbox" />
              <span>Send cohort onboarding mail</span>
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
  const [maxAttempts, setMaxAttempts] = useState(1);
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
              <span>Max Projects per Cohort</span>
              <input min={1} max={1000} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value))} type="number" />
            </label>
            <div className="form-banner enroll-student-form__wide">
              This controls how many different live projects the student can submit for each cohort.
            </div>
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
          <button className="segmented-button" disabled={updateAttempts.isPending} onClick={() => void saveAttempts(1, 'Reset to default')} type="button">
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
  entryMode,
  error,
  existingEmails,
  importStudents,
  importProgress,
  onClose,
  onConfirm,
  onDownloadTemplate,
  onEntryModeChange,
  onFile,
  onPasteRows,
  preview,
  result,
  setPreview,
  programOptions,
  roleOptions,
  uploading
}: {
  cohortOptions: AdminCohort[];
  entryMode: StudentImportEntryMode;
  error: string | null;
  existingEmails: Set<string>;
  importStudents: ReturnType<typeof useImportAdminStudents>;
  importProgress: StudentImportProgress | null;
  onClose: () => void;
  onDownloadTemplate: () => Promise<void> | void;
  onEntryModeChange: (mode: StudentImportEntryMode) => void;
  onConfirm: (assignmentMode: StudentImportAssignmentMode) => Promise<void>;
  onFile: (file: File) => Promise<void>;
  onPasteRows: (text: string) => Promise<void>;
  preview: StudentImportPreview | null;
  programOptions: AdminProgram[];
  result: AdminStudentImportRowResult[] | null;
  roleOptions: AdminProjectRole[];
  setPreview: (updater: (current: StudentImportPreview | null) => StudentImportPreview | null) => void;
  uploading: boolean;
}) {
  const [previewFilter, setPreviewFilter] = useState<StudentImportPreviewFilter>('all');
  const [importAssignmentMode, setImportAssignmentMode] = useState<StudentImportAssignmentMode>('add');
  const [selectedRowNumbers, setSelectedRowNumbers] = useState<number[]>([]);
  const [bulkCohortNames, setBulkCohortNames] = useState<string[]>([]);
  const [bulkProgramNames, setBulkProgramNames] = useState<string[]>([]);
  const [bulkRoleIds, setBulkRoleIds] = useState<string[]>([]);
  const [editingRowNumber, setEditingRowNumber] = useState<number | null>(null);
  const [pasteText, setPasteText] = useState('');
  const validRows = preview?.rows.filter((row) => row.errors.length === 0) ?? [];
  const invalidRows = preview?.rows.filter((row) => row.errors.length > 0) ?? [];
  const previewRows = useMemo(() => preview?.rows ?? [], [preview?.rows]);
  const cohortByName = useMemo(() => new Map(cohortOptions.map((cohort) => [cohort.name.toLowerCase(), cohort])), [cohortOptions]);
  const programByName = useMemo(() => new Map(programOptions.flatMap((program) => [[program.name.toLowerCase(), program], [program.programKey.toLowerCase(), program]] as const)), [programOptions]);
  const roleByIdOrName = useMemo(() => buildRoleLookup(roleOptions), [roleOptions]);
  const cohortPickerOptions = useMemo(() => cohortOptions.map((cohort) => ({ id: cohort.id, label: cohort.name, meta: cohort.status.toUpperCase(), value: cohort.name })), [cohortOptions]);
  const programPickerOptions = useMemo(() => programOptions.map((program) => ({ id: program.id, label: program.name, meta: program.programKey, value: program.name })), [programOptions]);
  const rolePickerOptions = useMemo(() => roleOptions.map((role) => ({ id: role.id, label: role.name, meta: [role.roleId, role.programKey].filter(Boolean).join(' · '), value: role.roleId ?? role.id })), [roleOptions]);
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
  const editingRow = editingRowNumber === null ? null : previewRows.find((row) => row.rowNumber === editingRowNumber) ?? null;
  const isImporting = Boolean(importProgress) || importStudents.isPending;

  useEffect(() => {
    setSelectedRowNumbers((current) => {
      const next = current.filter((rowNumber) => previewRows.some((row) => row.rowNumber === rowNumber));
      return next.length === current.length ? current : next;
    });
  }, [previewRows]);

  useEffect(() => {
    if (editingRowNumber !== null && !previewRows.some((row) => row.rowNumber === editingRowNumber)) {
      setEditingRowNumber(null);
    }
  }, [editingRowNumber, previewRows]);

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
        errors: validateImportPayload(row.payload, cohortByName, programByName, roleByIdOrName, Boolean(email && (emailCounts.get(email) ?? 0) > 1)),
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
              : {}),
            ...(bulkRoleIds.length > 0
              ? {
                  liveProjectRoleIds: bulkRoleIds
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

  async function handlePastePreview() {
    await onPasteRows(pasteText);
  }

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="student-import-title" aria-modal="true" className="student-modal student-import-modal" role="dialog">
        <header className="student-modal__header">
          <div>
            <span className="modal-eyebrow">Student Import</span>
            <h2 id="student-import-title">{preview ? preview.fileName : 'Upload students'}</h2>
          </div>
          <button aria-label="Close import preview" className="student-modal__icon-button" disabled={isImporting} onClick={onClose} type="button">
            <X size={26} />
          </button>
        </header>
        <div className="student-modal__body">
          {!preview ? (
            <div className="student-import-upload">
              <div className="student-import-entry-tabs" role="group" aria-label="Choose student import method">
                <button className={`segmented-button ${entryMode === 'file' ? 'segmented-button--active' : ''}`} onClick={() => onEntryModeChange('file')} type="button">
                  <FileUp size={16} />
                  Upload file
                </button>
                <button className={`segmented-button ${entryMode === 'paste' ? 'segmented-button--active' : ''}`} onClick={() => onEntryModeChange('paste')} type="button">
                  <ClipboardPaste size={16} />
                  Paste table
                </button>
                <button className="segmented-button" onClick={() => void onDownloadTemplate()} type="button">
                  <Download size={16} />
                  Download template
                </button>
              </div>
              {entryMode === 'file' ? (
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
              ) : (
                <section className="student-import-paste-panel" aria-label="Paste student table">
                  <div>
                    <strong>Paste rows from Google Sheets</strong>
                    <span>Use the same column order as the Excel template. Header row is optional.</span>
                  </div>
                  <textarea
                    autoFocus
                    disabled={uploading}
                    onChange={(event) => setPasteText(event.target.value)}
                    placeholder={studentImportHeaders.join('\t')}
                    value={pasteText}
                  />
                  <div className="student-import-paste-panel__actions">
                    <button className="segmented-button" onClick={() => setPasteText('')} type="button" disabled={!pasteText.trim() || uploading}>
                      Clear
                    </button>
                    <button className="segmented-button segmented-button--active" onClick={() => void handlePastePreview()} type="button" disabled={!pasteText.trim() || uploading}>
                      {uploading ? 'Reading rows...' : 'Review Pasted Rows'}
                    </button>
                  </div>
                </section>
              )}
              {error ? <div className="form-banner form-banner--error">{error}</div> : null}
            </div>
          ) : (
            <>
              <div className="student-import-summary">
                <DetailField label="Ready to import" value={String(validRows.length)} />
                <DetailField label="Needs review" value={String(invalidRows.length)} />
                <DetailField label="Total rows" value={String(preview.rows.length)} />
              </div>
              {importProgress ? (
                <section className="student-import-progress" aria-label="Student import progress" aria-live="polite">
                  <div className="student-import-progress__header">
                    <div>
                      <strong>Importing students</strong>
                      <span>
                        {importProgress.completed} of {importProgress.total} processed
                      </span>
                    </div>
                    <b>{importProgress.percent}%</b>
                  </div>
                  <div className="student-import-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={importProgress.percent}>
                    <span style={{ width: `${importProgress.percent}%` }} />
                  </div>
                  <p>
                    Created {importProgress.created}, updated {importProgress.updated}
                    {importProgress.failed ? `, failed ${importProgress.failed}` : ''}.
                  </p>
                </section>
              ) : null}
              <div className="student-import-modebar">
                <div>
                  <strong>{editingRow ? `Editing row ${editingRow.rowNumber}` : 'Review rows'}</strong>
                  <span>{editingRow ? 'Use the side editor for student details, cohorts, programs, invite, and onboarding actions.' : 'Scan the import rows below. Open any row for a cleaner edit experience.'}</span>
                </div>
                {editingRow ? (
                  <button className="segmented-button" onClick={() => setEditingRowNumber(null)} type="button">
                    Close Editor
                  </button>
                ) : null}
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
              <div className="student-import-bulkbar" aria-label="Bulk apply import tags">
                <div>
                  <strong>{selectedRowNumbers.length} selected</strong>
                  <span>Select rows, choose cohorts/programs/roles, then apply to those rows.</span>
                </div>
                <StudentImportMultiSelect label="bulk cohorts" options={cohortPickerOptions} selected={bulkCohortNames} onChange={setBulkCohortNames} />
                <StudentImportMultiSelect label="bulk programs" options={programPickerOptions} selected={bulkProgramNames} onChange={setBulkProgramNames} />
                <StudentImportMultiSelect label="bulk live project roles" options={rolePickerOptions} selected={bulkRoleIds} onChange={setBulkRoleIds} />
                <button className="segmented-button segmented-button--active" disabled={selectedRowNumbers.length === 0 || (bulkCohortNames.length === 0 && bulkProgramNames.length === 0 && bulkRoleIds.length === 0)} onClick={applyBulkImportAssignments} type="button">
                  Apply to Selected
                </button>
              </div>
              <div className={`student-import-editor-layout ${editingRow ? 'student-import-editor-layout--open' : ''}`}>
                <div className="student-import-table-wrap">
                  <table className="data-table student-import-table student-import-edit-table">
                    <colgroup>
                      <col className="student-import-col--select" />
                      <col className="student-import-col--row" />
                      <col className="student-import-col--student" />
                      <col className="student-import-col--email" />
                      <col className="student-import-col--profile" />
                      <col className="student-import-col--cohorts" />
                      <col className="student-import-col--programs" />
                      <col className="student-import-col--actions" />
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
                        <th scope="col">Profile</th>
                        <th scope="col">Cohorts</th>
                        <th scope="col">Programs</th>
                        <th scope="col">Edit</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr key={row.rowNumber} className={`${row.errors.length > 0 ? 'student-import-row--invalid' : ''} ${editingRowNumber === row.rowNumber ? 'student-import-row--active' : ''}`.trim()}>
                          <td>
                            <button className="admin-student-check" onClick={() => toggleImportRow(row.rowNumber)} type="button" aria-label={`Select import row ${row.rowNumber}`}>
                              {selectedRowSet.has(row.rowNumber) ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>
                          </td>
                          <td>{row.rowNumber}</td>
                          <td>
                            <div className="student-import-readonly">
                              <strong>{formatValue(row.payload.fullName)}</strong>
                              <span>{formatValue(row.payload.studentId)}</span>
                            </div>
                          </td>
                          <td>
                            <div className="student-import-readonly">
                              <strong>{formatValue(row.payload.email)}</strong>
                              <span>{formatValue(row.payload.altEmail)}</span>
                            </div>
                          </td>
                          <td>
                            <div className="student-import-readonly">
                              <strong>{formatValue(row.payload.educationYear)}</strong>
                              <span>Mentor: {formatValue(row.payload.personalMentor)}</span>
                              <span>Onboarding: {formatDate(row.payload.onboardingDate)}</span>
                              <span>Duration: {formatValue(row.payload.liveProjectDuration)}</span>
                            </div>
                          </td>
                          <td>
                            <span className="student-import-readonly-list">{formatList(row.payload.cohortNames)}</span>
                          </td>
                          <td>
                            <span className="student-import-readonly-list">{formatList(row.payload.programNames)}</span>
                            <small>{formatList(row.payload.liveProjectRoleIds)}</small>
                          </td>
                          <td>
                            <button className={`segmented-button student-import-edit-button ${editingRowNumber === row.rowNumber ? 'segmented-button--active' : ''}`} onClick={() => setEditingRowNumber(row.rowNumber)} type="button">
                              <Pencil size={15} />
                              Edit
                            </button>
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
                {editingRow ? (
                  <aside className="student-import-row-editor" aria-label={`Edit import row ${editingRow.rowNumber}`}>
                    <div className="student-import-row-editor__header">
                      <div>
                        <span className="modal-eyebrow">Row {editingRow.rowNumber}</span>
                        <strong>{formatValue(editingRow.payload.fullName, 'Student details')}</strong>
                      </div>
                      <button aria-label="Close row editor" className="student-modal__icon-button" onClick={() => setEditingRowNumber(null)} type="button">
                        <X size={20} />
                      </button>
                    </div>
                    <div className="student-import-row-editor__body">
                      <div className="student-import-editor-section">
                        <strong>Student identity</strong>
                        <div className="student-import-editor-grid">
                          <label>
                            <span>Full name</span>
                            <input value={editingRow.payload.fullName} onChange={(event) => updatePayload(editingRow.rowNumber, { fullName: event.target.value })} placeholder="Full name" type="text" />
                          </label>
                          <label>
                            <span>Student ID</span>
                            <input value={editingRow.payload.studentId ?? ''} onChange={(event) => updatePayload(editingRow.rowNumber, { studentId: event.target.value || undefined })} placeholder="Student ID" type="text" />
                          </label>
                          <label>
                            <span>Email</span>
                            <input value={editingRow.payload.email} onChange={(event) => updatePayload(editingRow.rowNumber, { email: event.target.value.toLowerCase() })} placeholder="Email" type="email" />
                          </label>
                          <label>
                            <span>Alt email</span>
                            <input value={editingRow.payload.altEmail ?? ''} onChange={(event) => updatePayload(editingRow.rowNumber, { altEmail: event.target.value || undefined })} placeholder="Alt email" type="email" />
                          </label>
                          <label>
                            <span>Phone</span>
                            <input value={editingRow.payload.phone ?? ''} onChange={(event) => updatePayload(editingRow.rowNumber, { phone: event.target.value || undefined })} placeholder="Phone" type="tel" />
                          </label>
                          <label>
                            <span>College</span>
                            <input value={editingRow.payload.collegeName ?? ''} onChange={(event) => updatePayload(editingRow.rowNumber, { collegeName: event.target.value || undefined })} placeholder="College name" type="text" />
                          </label>
                          <label>
                            <span>Education Year</span>
                            <select value={editingRow.payload.educationYear ?? ''} onChange={(event) => updatePayload(editingRow.rowNumber, { educationYear: event.target.value || undefined })}>
                              <option value="">Select education year</option>
                              {educationYearOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Opted for Personal Mentor</span>
                            <select value={editingRow.payload.personalMentor ?? ''} onChange={(event) => updatePayload(editingRow.rowNumber, { personalMentor: event.target.value || undefined })}>
                              <option value="">Select mentor option</option>
                              {personalMentorOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Onboarding Date</span>
                            <input value={editingRow.payload.onboardingDate ?? ''} onChange={(event) => updatePayload(editingRow.rowNumber, { onboardingDate: event.target.value || undefined })} type="date" />
                          </label>
                          <label>
                            <span>Live Project Duration</span>
                            <select value={editingRow.payload.liveProjectDuration ?? ''} onChange={(event) => updatePayload(editingRow.rowNumber, { liveProjectDuration: event.target.value || undefined })}>
                              <option value="">Select duration</option>
                              {liveProjectDurationOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                      <div className="student-import-editor-section">
                        <strong>Cohorts and programs</strong>
                        <label className="student-import-editor-picker">
                          <span>Cohorts</span>
                          <StudentImportMultiSelect
                            label="cohorts"
                            options={cohortPickerOptions}
                            selected={editingRow.payload.cohortNames ?? []}
                            onChange={(cohortNames) => {
                              const selectedCohorts = cohortOptions.filter((cohort) => cohortNames.includes(cohort.name));
                              updatePayload(editingRow.rowNumber, { cohortIds: selectedCohorts.map((cohort) => cohort.id), cohortNames, slot: deriveSlotFromSelectedCohorts(selectedCohorts) || undefined });
                            }}
                          />
                        </label>
                        <label className="student-import-editor-picker">
                          <span>Programs</span>
                          <StudentImportMultiSelect
                            label="programs"
                            options={programPickerOptions}
                            selected={editingRow.payload.programNames ?? []}
                            onChange={(programNames) => {
                              const selectedPrograms = programOptions.filter((program) => programNames.includes(program.name));
                              updatePayload(editingRow.rowNumber, { programKeys: selectedPrograms.map((program) => program.programKey), programNames });
                            }}
                          />
                        </label>
                        <label className="student-import-editor-picker">
                          <span>Live Project Role</span>
                          <StudentImportMultiSelect
                            label="live project roles"
                            metaLabel="Role ID"
                            options={rolePickerOptions}
                            selected={editingRow.payload.liveProjectRoleIds ?? []}
                            onChange={(liveProjectRoleIds) => updatePayload(editingRow.rowNumber, { liveProjectRoleIds })}
                          />
                        </label>
                      </div>
                      <div className="student-import-editor-section">
                        <strong>Email actions</strong>
                        <div className="student-import-editor-actions">
                          <label className="student-import-checkbox">
                            <input
                              checked={editingRow.sendPortalInvite}
                              disabled={editingRow.existingStudent}
                              onChange={(event) => updateRow(editingRow.rowNumber, (current) => ({ ...current, sendPortalInvite: event.target.checked }))}
                              type="checkbox"
                            />
                            <span>{editingRow.existingStudent ? 'Existing student - invite skipped' : 'Send portal invite'}</span>
                          </label>
                          <label className="student-import-checkbox">
                            <input checked={editingRow.sendOnboardingMail} onChange={(event) => updateRow(editingRow.rowNumber, (current) => ({ ...current, sendOnboardingMail: event.target.checked }))} type="checkbox" />
                            <span>Send onboarding email</span>
                          </label>
                        </div>
                      </div>
                      <div className="student-import-editor-section">
                        <strong>Row status</strong>
                        {editingRow.errors.length > 0 ? (
                          <div className="student-import-errors">
                            {editingRow.errors.map((item) => (
                              <span key={item}>{item}</span>
                            ))}
                          </div>
                        ) : (
                          <StatusBadge tone="safe">Ready to import</StatusBadge>
                        )}
                      </div>
                    </div>
                  </aside>
                ) : null}
              </div>
            </>
          )}
          {result ? (
            <section className="student-import-results" aria-label="Import results">
              <strong>Import result</strong>
              {result.slice(0, 100).map((row) => (
                <p key={`${row.rowNumber}-${row.email ?? 'row'}`}>
                  Row {row.rowNumber}: {row.status === 'success' ? row.action : row.error}
                  {row.status === 'success' && row.error ? ` (${row.error})` : ''}
                </p>
              ))}
            </section>
          ) : null}
        </div>
        <footer className="student-modal__footer enroll-student-modal__footer">
          <button className="segmented-button" disabled={isImporting} onClick={onClose} type="button">
            Close
          </button>
          {preview ? (
            <button className="segmented-button segmented-button--active" disabled={validRows.length === 0 || isImporting} onClick={() => void onConfirm(importAssignmentMode)} type="button">
              {isImporting ? `${importProgress?.percent ?? 0}% Importing` : `Import ${validRows.length} Rows`}
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
  const limit = parseRowsPerPage(searchParams.get('limit'));
  const sort = parseStudentSort(searchParams.get('sort'));
  const direction = parseSortDirection(searchParams.get('direction'));
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
  const [importProgress, setImportProgress] = useState<StudentImportProgress | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportParsing, setIsImportParsing] = useState(false);
  const [importEntryMode, setImportEntryMode] = useState<StudentImportEntryMode>('file');
  const [importExistingEmails, setImportExistingEmails] = useState<Set<string>>(new Set());
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkAssignForm, setBulkAssignForm] = useState<BulkAssignForm>({ assignmentMode: 'add', cohortNames: [], programNames: [] });

  const adminProfileQuery = useAdminProfile();
  const adminRole = adminProfileQuery.data?.role;
  const adminPermissions = adminProfileQuery.data?.permissions;
  const canManageStudents = Boolean(adminRole) && hasAdminPermission(adminRole, 'admin.students.manage', adminPermissions);
  const canImportStudents = Boolean(adminRole) && hasAdminPermission(adminRole, 'admin.students.import', adminPermissions);
  const canExportStudents = Boolean(adminRole) && hasAdminPermission(adminRole, 'admin.students.export', adminPermissions);
  const canInviteStudents = Boolean(adminRole) && hasAdminPermission(adminRole, 'admin.students.invite', adminPermissions);
  const studentsQuery = useAdminStudents({ page, programKey, search, status, cohortName, limit, sort, direction });
  const studentCollegeOptionsQuery = useAdminStudentCollegeOptions();
  const exportStudents = useExportAdminStudents();
  const saveStudent = useSaveAdminStudent();
  const updateStudent = useUpdateAdminStudent();
  const updateStudentStatus = useUpdateAdminStudentStatus();
  const importStudents = useImportAdminStudents();
  const bulkUpdateStudents = useBulkUpdateAdminStudents();
  const backfillAuthLinks = useBackfillAdminStudentAuthLinks();
  const resendStudentInvite = useResendAdminStudentInvite();
  const programsQuery = useAdminPrograms({ limit: 100, page: 1, status: 'all' });
  const rolesQuery = useAdminProjectRoles({ limit: 500, page: 1, status: 'active' });
  const cohortsPageOneQuery = useAdminCohorts({ limit: 100, page: 1, status: 'all' });
  const cohortsPageTwoQuery = useAdminCohorts({ enabled: cohortsPageOneQuery.data?.hasNextPage === true, limit: 100, page: 2, status: 'all' });
  const cohortsPageThreeQuery = useAdminCohorts({ enabled: cohortsPageTwoQuery.data?.hasNextPage === true, limit: 100, page: 3, status: 'all' });
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
  const roleRecords = useMemo(() => rolesQuery.data?.items ?? [], [rolesQuery.data?.items]);
  const pageCollegeOptions = useMemo(() => uniqueSorted(data?.items.map((student) => student.collegeName) ?? []), [data?.items]);
  const collegeOptions = studentCollegeOptionsQuery.data?.items.length ? studentCollegeOptionsQuery.data.items : pageCollegeOptions;
  const selectedStudents = useMemo(() => pageStudents.filter((student) => selectedStudentIds.includes(student.id)), [pageStudents, selectedStudentIds]);
  const selectedCount = selectedStudentIds.length;
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    setSelectedStudentIds([]);
  }, [page, search, status, cohortName, programKey, limit, sort, direction]);

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

  function handleRowsPerPageChange(nextLimit: string) {
    updateParams({ limit: nextLimit });
  }

  function handleSort(nextSort: StudentSortKey) {
    const nextDirection: SortDirection = sort === nextSort && direction === 'asc' ? 'desc' : 'asc';
    updateParams({ sort: nextSort, direction: nextDirection });
  }

  function renderSortHeader(label: string, key: StudentSortKey) {
    const isActive = sort === key;
    return (
      <button
        aria-label={`Sort by ${label}`}
        aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`admin-student-sort-button ${isActive ? 'admin-student-sort-button--active' : ''}`}
        onClick={() => handleSort(key)}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden="true">{isActive ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    );
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
    const headers = studentExportHeaders;
    const lines = [
      headers.join(','),
      ...students.map((student) =>
        [
          student.onboardingSequence,
          student.studentId,
          student.fullName,
          student.email,
          student.altEmail,
          student.phone,
          student.collegeName,
          formatList(studentCohortNames(student), student.cohortName),
          formatList(student.programs, student.programName),
          student.waGroup,
          student.personalMentor,
          student.educationYear,
          student.onboardingDate ? student.onboardingDate.slice(0, 10) : '',
          student.liveProjectDuration,
          formatRoleList(student),
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
        ['STU-1001', 'Example Student', 'student@example.com', '', '+91 90000 00000', 'Example College', 'Cohort A|Cohort B', 'Program A|Program B', 'WA Group Name', 'Yes', 'Graduate', '2026-07-05', '4 weeks', 'Business Analyst|hr_intern', 'pending', 'true']
      ];
      const cohortRows: SheetData = [
        ['Cohort Name', 'Cohort ID', 'Start Date', 'Derived Slot', 'Status'],
        ...cohortRecords.map((cohort) => [cohort.name, cohort.id, cohort.startDate ?? '', deriveSlotFromCohortStartDate(cohort), cohort.status])
      ];
      const programRows: SheetData = [['Program Name', 'Program Key', 'Status'], ...programRecords.map((program) => [program.name, program.programKey, program.status])];
      const roleRows: SheetData = [['Role Name', 'Role ID', 'Program Key', 'Status'], ...roleRecords.map((role) => [role.name, role.roleId ?? '', role.programKey ?? '', role.status])];
      const sheets: Array<Sheet<Blob>> = [
        { data: studentRows, sheet: 'Students' },
        { data: cohortRows, sheet: 'Cohorts' },
        { data: programRows, sheet: 'Programs' },
        { data: roleRows, sheet: 'Live Project Roles' }
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
      const result = await exportStudents.mutateAsync({ cohortName, direction, programKey, search, sort, status });
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

  function openImportModal(mode: StudentImportEntryMode = 'file') {
    setImportError(null);
    setImportPreview(null);
    setImportResultRows(null);
    setImportProgress(null);
    setImportEntryMode(mode);
    setIsImportModalOpen(true);
  }

  function closeImportModal(force = false) {
    if (!force && (importProgress || importStudents.isPending)) return;
    setIsImportModalOpen(false);
    setImportError(null);
    setImportPreview(null);
    setImportResultRows(null);
    setImportProgress(null);
    setIsImportParsing(false);
    setImportExistingEmails(new Set());
    setImportEntryMode('file');
  }

  async function buildImportPreviewFromRows(rows: string[][], sourceName: string) {
    const [firstRow, ...remainingRows] = rows;
    const headers = firstRow && looksLikeImportHeader(firstRow) ? firstRow : studentImportHeaders;
    const bodyRows = firstRow && looksLikeImportHeader(firstRow) ? remainingRows : rows;
    if (!headers || bodyRows.length === 0) {
      setImportError('No student rows found. Use the template format and try again.');
      return;
    }

    const cohortByName = new Map(cohortRecords.map((cohort) => [cohort.name.toLowerCase(), cohort]));
    const programByKeyOrName = new Map(programRecords.flatMap((program) => [[program.name.toLowerCase(), program], [program.programKey.toLowerCase(), program]] as const));
    const roleByIdOrName = buildRoleLookup(roleRecords);
    const existingResult = await exportStudents.mutateAsync({ status: 'all' });
    const existingEmails = new Set(existingResult.items.map((student) => student.email.trim().toLowerCase()).filter(Boolean));
    setImportExistingEmails(existingEmails);

    const emailCounts = bodyRows.reduce<Map<string, number>>((counts, row) => {
      const email = buildImportPayloadFromRow(row, headers, cohortByName, programByKeyOrName, roleByIdOrName).email.trim().toLowerCase();
      if (email) counts.set(email, (counts.get(email) ?? 0) + 1);
      return counts;
    }, new Map());

    const rowNumberOffset = firstRow && looksLikeImportHeader(firstRow) ? 2 : 1;
    const previewRows = bodyRows.map((row, index) => {
      const payload = buildImportPayloadFromRow(row, headers, cohortByName, programByKeyOrName, roleByIdOrName);
      const email = payload.email.trim().toLowerCase();
      const existingStudent = existingEmails.has(email);
      return {
        errors: validateImportPayload(payload, cohortByName, programByKeyOrName, roleByIdOrName, Boolean(email && (emailCounts.get(email) ?? 0) > 1)),
        existingStudent,
        payload,
        rowNumber: index + rowNumberOffset,
        sendOnboardingMail: true,
        sendPortalInvite: !existingStudent
      };
    });

    if (previewRows.length === 0) {
      setImportError('No readable student rows found.');
      return;
    }

    setImportPreview({ fileName: sourceName, rows: previewRows });
  }

  async function handleImportFile(file: File) {
    try {
      setImportError(null);
      setImportResultRows(null);
      setImportProgress(null);
      setIsImportParsing(true);
      await buildImportPreviewFromRows(await readImportRows(file), file.name);
    } catch (error) {
      setImportError(readableError(error, 'Import file could not be read.'));
    } finally {
      setIsImportParsing(false);
    }
  }

  async function handleImportPaste(text: string) {
    try {
      setImportError(null);
      setImportResultRows(null);
      setImportProgress(null);
      setIsImportParsing(true);
      const rows = parsePastedTableRows(text);
      if (rows.length === 0) {
        setImportError('Paste at least one student row before reviewing.');
        return;
      }
      await buildImportPreviewFromRows(rows, 'Pasted student table');
    } catch (error) {
      setImportError(readableError(error, 'Pasted rows could not be read.'));
    } finally {
      setIsImportParsing(false);
    }
  }

  async function confirmImportStudents(assignmentMode: StudentImportAssignmentMode = 'add') {
    if (!importPreview) return;
    const validImportRows = importPreview.rows.filter((row) => row.errors.length === 0);
    const payload = validImportRows
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
    const aggregate = { created: 0, failed: 0, rows: [] as AdminStudentImportRowResult[], updated: 0 };
    setImportError(null);
    setImportResultRows(null);
    setImportProgress({ completed: 0, created: 0, failed: 0, percent: 0, total: payload.length, updated: 0 });

    try {
      for (let index = 0; index < payload.length; index += studentImportBatchSize) {
        const batchPayload = payload.slice(index, index + studentImportBatchSize);
        const batchRows = validImportRows.slice(index, index + studentImportBatchSize);
        const result = await importStudents.mutateAsync({ invalidate: false, students: batchPayload });
        const normalizedRows = (result.rows ?? []).map((row, rowIndex) => ({
          ...row,
          rowNumber: batchRows[rowIndex]?.rowNumber ?? row.rowNumber
        }));
        aggregate.created += result.created;
        aggregate.updated += result.updated;
        aggregate.failed += result.failed;
        aggregate.rows.push(...normalizedRows);

        const completed = Math.min(payload.length, index + batchPayload.length);
        setImportProgress({
          completed,
          created: aggregate.created,
          failed: aggregate.failed,
          percent: Math.round((completed / payload.length) * 100),
          total: payload.length,
          updated: aggregate.updated
        });
      }

      setImportResultRows(aggregate.rows);
      setActionMessage(`Student import finished: ${aggregate.created} created, ${aggregate.updated} updated, ${aggregate.failed} failed.`);
      await studentsQuery.refetch();
      if (aggregate.failed === 0) {
        window.setTimeout(() => {
          setImportProgress(null);
          closeImportModal(true);
        }, 650);
      }
    } catch (error) {
      setImportError(readableError(error, 'Student import failed before all rows were processed.'));
      setImportProgress(null);
    } finally {
      if (aggregate.failed > 0) setImportProgress(null);
    }
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
          {canExportStudents ? (
            <button className="segmented-button" disabled={!data?.items.length || exportStudents.isPending} onClick={() => void handleExportCsv()} type="button">
              <Download size={16} />
              {exportStudents.isPending ? 'Exporting...' : 'Export Filtered'}
            </button>
          ) : null}
          {canImportStudents ? (
            <>
              <button className="segmented-button" disabled={importStudents.isPending || isImportParsing} onClick={() => openImportModal('file')} type="button">
                <FileUp size={16} />
                Import
              </button>
              <button className="segmented-button" disabled={importStudents.isPending || isImportParsing} onClick={() => openImportModal('paste')} type="button">
                <ClipboardPaste size={16} />
                Paste Table
              </button>
            </>
          ) : null}
          {canManageStudents ? (
            <button className="segmented-button segmented-button--active" onClick={() => setIsEnrollModalOpen(true)} type="button">
              <Plus size={16} />
              Enroll Student
            </button>
          ) : null}
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
          {canManageStudents ? (
            <>
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
              <button className="segmented-button" disabled={backfillAuthLinks.isPending} onClick={() => void handleBackfillAuthLinks()} type="button">
                <Link2 size={16} />
                Link auth
              </button>
            </>
          ) : null}
          {canInviteStudents ? (
            <button className="segmented-button" disabled={bulkUpdateStudents.isPending} onClick={() => void runBulkUpdate({ resendInvite: true }, 'Invite resend finished')} type="button">
              <Mail size={16} />
              Resend invites
            </button>
          ) : null}
          {canExportStudents ? (
            <button className="segmented-button" onClick={handleExportSelectedCsv} type="button">
              <Download size={16} />
              Export selected
            </button>
          ) : null}
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
                <col className="admin-student-col--serial" />
                <col className="admin-student-col--name" />
                <col className="admin-student-col--access" />
                <col className="admin-student-col--education" />
                <col className="admin-student-col--mentor" />
                <col className="admin-student-col--onboarding" />
                <col className="admin-student-col--duration" />
                <col className="admin-student-col--role" />
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
                  <th scope="col">{renderSortHeader('Serial', 'sequence')}</th>
                  <th scope="col">{renderSortHeader('Student', 'student')}</th>
                  <th scope="col">{renderSortHeader('Access', 'access')}</th>
                  <th scope="col">{renderSortHeader('Education Year', 'education')}</th>
                  <th scope="col">{renderSortHeader('Personal Mentor', 'mentor')}</th>
                  <th scope="col">{renderSortHeader('Onboarding Date', 'onboarding')}</th>
                  <th scope="col">{renderSortHeader('Live Project Duration', 'duration')}</th>
                  <th scope="col">Live Project Role</th>
                  <th scope="col">{renderSortHeader('Auth & Invite', 'auth')}</th>
                  <th scope="col">{renderSortHeader('Status', 'status')}</th>
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
                      <span className="admin-student-serial">{formatValue(student.onboardingSequence)}</span>
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
                      <span className="admin-student-table-value">{formatValue(student.educationYear)}</span>
                    </td>
                    <td>
                      <span className="admin-student-table-value">{formatValue(student.personalMentor)}</span>
                    </td>
                    <td>
                      <span className="admin-student-table-value">{formatDate(student.onboardingDate)}</span>
                    </td>
                    <td>
                      <span className="admin-student-table-value">{formatValue(student.liveProjectDuration)}</span>
                    </td>
                    <td>
                      <span className="admin-student-role-list">{formatRoleList(student)}</span>
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
                        {canManageStudents ? (
                          <>
                            <button className="segmented-button" onClick={() => setEditingStudent(student)} type="button">
                              Edit
                            </button>
                            <button className="segmented-button" onClick={() => setAttemptStudent(student)} type="button">
                              LP Attempts
                            </button>
                            <button className="segmented-button" disabled={updateStudentStatus.isPending} onClick={() => setPendingStatusChange({ student })} type="button">
                              {student.active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </>
                        ) : null}
                        {canInviteStudents ? (
                          <button className="segmented-button" disabled={resendStudentInvite.isPending} onClick={() => void handleResendInvite(student)} type="button">
                            Invite
                          </button>
                        ) : null}
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
          <Link className="pagination-link" to={buildPageLink(page - 1, search, status, cohortName, programKey, limit, sort, direction)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, search, status, cohortName, programKey, limit, sort, direction)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
        <label className="pagination-size-control">
          <span>Rows per page</span>
          <select aria-label="Rows per page" value={limit} onChange={(event) => handleRowsPerPageChange(event.target.value)}>
            {studentRowsPerPageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </nav>

      {selectedStudent ? <StudentDetailsModal student={selectedStudent} onClose={() => setSelectedStudent(null)} /> : null}
      {isEnrollModalOpen && canManageStudents ? (
        <EnrollStudentModal
          cohortOptions={cohortRecords}
          collegeOptions={collegeOptions}
          mode="create"
          onClose={() => setIsEnrollModalOpen(false)}
          onSubmit={handleCreateStudent}
          programOptions={programRecords}
          roleOptions={roleRecords}
        />
      ) : null}
      {editingStudent && canManageStudents ? (
        <EnrollStudentModal
          cohortOptions={cohortRecords}
          collegeOptions={collegeOptions}
          mode="edit"
          onClose={() => setEditingStudent(null)}
          onSubmit={handleEditStudent}
          programOptions={programRecords}
          roleOptions={roleRecords}
          student={editingStudent}
        />
      ) : null}
      {attemptStudent && canManageStudents ? <LpAttemptsModal student={attemptStudent} onClose={() => setAttemptStudent(null)} /> : null}
      {isImportModalOpen && canImportStudents ? (
        <ImportPreviewModal
          cohortOptions={cohortRecords}
          entryMode={importEntryMode}
          error={importError}
          existingEmails={importExistingEmails}
          importProgress={importProgress}
          importStudents={importStudents}
          onClose={closeImportModal}
          onConfirm={confirmImportStudents}
          onDownloadTemplate={handleDownloadImportTemplate}
          onEntryModeChange={setImportEntryMode}
          onFile={handleImportFile}
          onPasteRows={handleImportPaste}
          preview={importPreview}
          programOptions={programRecords}
          roleOptions={roleRecords}
          result={importResultRows}
          setPreview={setImportPreview}
          uploading={isImportParsing}
        />
      ) : null}
      {isBulkAssignOpen && canManageStudents ? (
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
      {pendingStatusChange && canManageStudents ? (
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
