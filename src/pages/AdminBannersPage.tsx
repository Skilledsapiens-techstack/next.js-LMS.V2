import { Archive, Bell, CheckCircle2, Edit3, Play, Save, Search, Send, XCircle } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { ProjectRichText } from '../components/ProjectRichText';
import { RichTextEditor } from '../components/RichTextEditor';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import {
  AdminBanner,
  AdminBannerAudience,
  AdminBannerStatus,
  AdminBannerType,
  AdminBannerWritePayload,
  useAdminBanners,
  useArchiveAdminBanner,
  useCreateAdminBanner,
  useUpdateAdminBanner,
  useUpdateAdminBannerStatus
} from '../features/admin/useAdminBanners';
import { useAdminCohorts } from '../features/admin/useAdminCohorts';
import { useAdminPrograms } from '../features/admin/useAdminPrograms';
import { AdminStudent, useAdminStudents } from '../features/admin/useAdminStudents';
import { StudentBannerDisplayType, StudentBannerPriority } from '../features/student/useStudentBanners';

type BannerFormState = {
  audience: AdminBannerAudience;
  bannerType: AdminBannerType;
  cohortNames: string[];
  ctaLabel: string;
  ctaUrl: string;
  customType: string;
  displayType: StudentBannerDisplayType;
  endAt: string;
  message: string;
  priority: StudentBannerPriority;
  programKeys: string[];
  requireAcknowledgement: boolean;
  startAt: string;
  status: AdminBannerStatus;
  selectedStudentEmails: string[];
  targetAtsCredits: boolean;
  targetPaidAccess: boolean;
  title: string;
};

const initialFormState: BannerFormState = {
  audience: 'all',
  bannerType: 'general',
  cohortNames: [],
  ctaLabel: '',
  ctaUrl: '',
  customType: '',
  displayType: 'login_popup',
  endAt: '',
  message: '',
  priority: 'normal',
  programKeys: [],
  requireAcknowledgement: false,
  startAt: '',
  status: 'active',
  selectedStudentEmails: [],
  targetAtsCredits: false,
  targetPaidAccess: false,
  title: ''
};

const bannerTypes: Array<{ label: string; value: AdminBannerType }> = [
  { label: 'General', value: 'general' },
  { label: 'New Launch', value: 'launch' },
  { label: 'Product Announcement', value: 'product' },
  { label: 'Workshop', value: 'workshop' },
  { label: 'Offer', value: 'offer' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Custom', value: 'custom' }
];

const displayTypes: Array<{ help: string; label: string; value: StudentBannerDisplayType }> = [
  { help: 'Centered card after login.', label: 'Login popup card', value: 'login_popup' },
  { help: 'Scrolling strip at the top.', label: 'Top running banner', value: 'top_running' },
  { help: 'Fixed top message strip.', label: 'Top sticky banner', value: 'top_sticky' },
  { help: 'Fixed bottom message strip.', label: 'Bottom sticky banner', value: 'bottom_sticky' },
  { help: 'Compact card near bottom-right.', label: 'Bottom-right floating card', value: 'bottom_right_floating' },
  { help: 'Appears inside the Banner inbox.', label: 'Floating bell/inbox', value: 'floating_bell' }
];

const priorities: Array<{ label: string; value: StudentBannerPriority }> = [
  { label: 'Low', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' }
];

function toDateTimeInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function formatDateTime(value?: string) {
  if (!value) return 'Immediate';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function formatLabel(value: string) {
  return value.split(/[_\s-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formFromBanner(banner: AdminBanner): BannerFormState {
  return {
    audience: banner.audience,
    bannerType: banner.bannerType,
    cohortNames: banner.cohortNames ?? [],
    ctaLabel: banner.ctaLabel ?? '',
    ctaUrl: banner.ctaUrl ?? '',
    customType: banner.customType ?? '',
    displayType: banner.displayType,
    endAt: toDateTimeInput(banner.endAt),
    message: banner.message,
    priority: banner.priority,
    programKeys: banner.programKeys ?? [],
    requireAcknowledgement: banner.requireAcknowledgement === true,
    startAt: toDateTimeInput(banner.startAt),
    status: banner.status,
    selectedStudentEmails: banner.studentEmails ?? [],
    targetAtsCredits: banner.targetAtsCredits === true,
    targetPaidAccess: banner.targetPaidAccess === true,
    title: banner.title
  };
}

function toPayload(form: BannerFormState): AdminBannerWritePayload {
  return {
    audience: form.audience,
    bannerType: form.bannerType,
    cohortNames: form.audience === 'cohort' ? form.cohortNames : [],
    ctaLabel: form.ctaLabel.trim() || null,
    ctaUrl: form.ctaUrl.trim() || null,
    customType: form.bannerType === 'custom' ? form.customType.trim() || null : null,
    displayType: form.displayType,
    endAt: form.endAt || null,
    message: form.message.trim(),
    priority: form.priority,
    programKeys: form.audience === 'program' ? form.programKeys : [],
    requireAcknowledgement: form.requireAcknowledgement,
    startAt: form.startAt || null,
    status: form.status,
    studentEmails: form.audience === 'student' ? form.selectedStudentEmails : [],
    targetAtsCredits: form.audience === 'access' && form.targetAtsCredits,
    targetPaidAccess: form.audience === 'access' && form.targetPaidAccess,
    title: form.title.trim()
  };
}

export function AdminBannersPage() {
  const [form, setForm] = useState<BannerFormState>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminBannerStatus | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  const bannersQuery = useAdminBanners({ limit: 50, search, status: statusFilter });
  const cohortsQuery = useAdminCohorts({ limit: 500, status: 'all' });
  const programsQuery = useAdminPrograms({ limit: 500, status: 'all' });
  const studentsQuery = useAdminStudents({
    enabled: form.audience === 'student' && studentSearch.trim().length >= 2,
    limit: 12,
    page: 1,
    search: studentSearch,
    status: 'active'
  });
  const createBanner = useCreateAdminBanner();
  const updateBanner = useUpdateAdminBanner();
  const updateStatus = useUpdateAdminBannerStatus();
  const archiveBanner = useArchiveAdminBanner();

  const cohorts = cohortsQuery.data?.items ?? [];
  const programs = programsQuery.data?.items ?? [];
  const studentResults = studentsQuery.data?.items ?? [];
  const isSaving = createBanner.isPending || updateBanner.isPending;

  const activeCount = useMemo(() => (bannersQuery.data?.items ?? []).filter((banner) => banner.status === 'active').length, [bannersQuery.data?.items]);

  const updateForm = <TKey extends keyof BannerFormState>(key: TKey, value: BannerFormState[TKey]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleListValue = (key: 'cohortNames' | 'programKeys', value: string) => {
    setForm((current) => {
      const values = current[key];
      return { ...current, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  };

  const toggleStudentEmail = (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    setForm((current) => ({
      ...current,
      selectedStudentEmails: current.selectedStudentEmails.includes(cleanEmail)
        ? current.selectedStudentEmails.filter((item) => item !== cleanEmail)
        : [...current.selectedStudentEmails, cleanEmail]
    }));
  };

  const removeStudentEmail = (email: string) => {
    setForm((current) => ({ ...current, selectedStudentEmails: current.selectedStudentEmails.filter((item) => item !== email) }));
  };

  const resultEmails = useMemo(
    () => Array.from(new Set(studentResults.map((student) => student.email.trim().toLowerCase()).filter(Boolean))),
    [studentResults]
  );
  const allVisibleStudentsSelected = resultEmails.length > 0 && resultEmails.every((email) => form.selectedStudentEmails.includes(email));

  const selectAllVisibleStudents = (checked: boolean) => {
    setForm((current) => {
      if (!checked) {
        return { ...current, selectedStudentEmails: current.selectedStudentEmails.filter((email) => !resultEmails.includes(email)) };
      }
      return { ...current, selectedStudentEmails: Array.from(new Set([...current.selectedStudentEmails, ...resultEmails])) };
    });
  };

  const clearSelectedStudents = () => {
    setForm((current) => ({ ...current, selectedStudentEmails: [] }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const payload = toPayload(form);
      if (editingId) {
        await updateBanner.mutateAsync({ bannerId: editingId, body: payload });
      } else {
        await createBanner.mutateAsync(payload);
      }
      setForm(initialFormState);
      setEditingId(null);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Banner could not be saved.');
    }
  };

  const handleEdit = (banner: AdminBanner) => {
    setEditingId(banner.id);
    setForm(formFromBanner(banner));
    window.scrollTo({ behavior: 'smooth', top: 0 });
  };

  return (
    <main className="page-frame admin-banners-page">
      <section className="admin-banners-toolbar">
        <div>
          <span className="section-eyebrow">Student Banners</span>
          <h1>Banner Manager</h1>
          <p>Create popup cards, sticky bars, running strips, and floating Banner cards for logged-in students.</p>
        </div>
        <div className="admin-banners-metrics">
          <span>{bannersQuery.data?.total ?? 0} total</span>
          <strong>{activeCount} active</strong>
        </div>
      </section>

      <form className="admin-banner-form" onSubmit={handleSubmit}>
        <div className="admin-banner-form-grid">
          <label>
            Title
            <input value={form.title} maxLength={160} onChange={(event) => updateForm('title', event.target.value)} required />
          </label>
          <label>
            Type
            <select value={form.bannerType} onChange={(event) => updateForm('bannerType', event.target.value as AdminBannerType)}>
              {bannerTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          {form.bannerType === 'custom' ? (
            <label>
              Custom type
              <input value={form.customType} onChange={(event) => updateForm('customType', event.target.value)} required />
            </label>
          ) : null}
          <label>
            Display style
            <select value={form.displayType} onChange={(event) => updateForm('displayType', event.target.value as StudentBannerDisplayType)}>
              {displayTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select value={form.priority} onChange={(event) => updateForm('priority', event.target.value as StudentBannerPriority)}>
              {priorities.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => updateForm('status', event.target.value as AdminBannerStatus)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <RichTextEditor
          className="admin-banner-rte"
          label="Message"
          onChange={(value) => updateForm('message', value)}
          placeholder="Write the Banner message. Use formatting for key dates, links, or workshop details."
          value={form.message}
        />

        <div className="admin-banner-form-grid">
          <label>
            CTA label
            <input value={form.ctaLabel} placeholder="Register now" onChange={(event) => updateForm('ctaLabel', event.target.value)} />
          </label>
          <label>
            CTA URL
            <input value={form.ctaUrl} placeholder="/student/schedule" onChange={(event) => updateForm('ctaUrl', event.target.value)} />
          </label>
          <label>
            Start time
            <input type="datetime-local" value={form.startAt} onChange={(event) => updateForm('startAt', event.target.value)} />
          </label>
          <label>
            End time
            <input type="datetime-local" value={form.endAt} onChange={(event) => updateForm('endAt', event.target.value)} />
          </label>
        </div>

        <div className="admin-banner-checkbox-row">
          <label>
            <input type="checkbox" checked={form.requireAcknowledgement} onChange={(event) => updateForm('requireAcknowledgement', event.target.checked)} />
            Require “I have read this” before dismissing
          </label>
        </div>

        <section className="admin-banner-targeting">
          <h2>Target audience</h2>
          <div className="admin-banner-segmented">
            {(['all', 'program', 'cohort', 'student', 'access'] as AdminBannerAudience[]).map((audience) => (
              <button className={form.audience === audience ? 'active' : ''} key={audience} onClick={() => updateForm('audience', audience)} type="button">
                {formatLabel(audience)}
              </button>
            ))}
          </div>
          {form.audience === 'program' ? (
            <div className="admin-banner-chip-grid">
              {programs.map((program) => (
                <label className="admin-banner-chip" key={program.id}>
                  <input checked={form.programKeys.includes(program.programKey)} onChange={() => toggleListValue('programKeys', program.programKey)} type="checkbox" />
                  {program.shortName || program.name}
                </label>
              ))}
            </div>
          ) : null}
          {form.audience === 'cohort' ? (
            <div className="admin-banner-chip-grid">
              {cohorts.map((cohort) => (
                <label className="admin-banner-chip" key={cohort.id}>
                  <input checked={form.cohortNames.includes(cohort.name)} onChange={() => toggleListValue('cohortNames', cohort.name)} type="checkbox" />
                  {cohort.name}
                </label>
              ))}
            </div>
          ) : null}
          {form.audience === 'student' ? (
            <section className="admin-banner-student-picker">
              <label className="admin-banner-student-search">
                Search students
                <div>
                  <Search size={16} />
                  <input
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Search by name, email, college, cohort, or program"
                  />
                </div>
              </label>
              {form.selectedStudentEmails.length > 0 ? (
                <div className="admin-banner-selected-students" aria-label="Selected students">
                  {form.selectedStudentEmails.map((email) => (
                    <span key={email}>
                      {email}
                      <button onClick={() => removeStudentEmail(email)} title={`Remove ${email}`} type="button">
                        <XCircle size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="admin-banner-student-bulkbar">
                <label>
                  <input
                    checked={allVisibleStudentsSelected}
                    disabled={resultEmails.length === 0}
                    onChange={(event) => selectAllVisibleStudents(event.target.checked)}
                    type="checkbox"
                  />
                  Select all results
                </label>
                <label>
                  <input
                    checked={false}
                    disabled={form.selectedStudentEmails.length === 0}
                    onChange={clearSelectedStudents}
                    type="checkbox"
                  />
                  Remove all
                </label>
                <span>{form.selectedStudentEmails.length} selected</span>
              </div>
              <div className="admin-banner-student-results">
                {studentSearch.trim().length < 2 ? (
                  <p>Type at least 2 characters to search students.</p>
                ) : studentsQuery.isLoading ? (
                  <p>Searching students...</p>
                ) : studentsQuery.isError ? (
                  <p>Students could not be loaded. Try another search.</p>
                ) : (studentsQuery.data?.items.length ?? 0) === 0 ? (
                  <p>No matching students found.</p>
                ) : (
                  studentResults.map((student: AdminStudent) => {
                    const email = student.email.trim().toLowerCase();
                    const selected = form.selectedStudentEmails.includes(email);
                    return (
                      <label className="admin-banner-student-result" key={student.id}>
                        <input checked={selected} onChange={() => toggleStudentEmail(email)} type="checkbox" />
                        <span>
                          <strong>{student.fullName || email}</strong>
                          <small>{email}</small>
                          <small>{[student.collegeName, student.programName, student.cohortName].filter(Boolean).join(' · ') || 'Student profile'}</small>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}
          {form.audience === 'access' ? (
            <div className="admin-banner-checkbox-row">
              <label>
                <input type="checkbox" checked={form.targetPaidAccess} onChange={(event) => updateForm('targetPaidAccess', event.target.checked)} />
                Students with paid access
              </label>
              <label>
                <input type="checkbox" checked={form.targetAtsCredits} onChange={(event) => updateForm('targetAtsCredits', event.target.checked)} />
                Students with ATS credits
              </label>
            </div>
          ) : null}
        </section>

        {error ? <p className="form-error">{error}</p> : null}
        <div className="admin-banner-actions">
          {editingId ? (
            <button className="student-action" onClick={() => { setEditingId(null); setForm(initialFormState); }} type="button">
              <XCircle size={16} /> Cancel
            </button>
          ) : null}
          <button className="student-action student-action--primary admin-banner-submit-button" disabled={isSaving} type="submit">
            {editingId ? <Save size={16} /> : <Send size={16} />}
            {editingId ? 'Save Banner' : 'Create Banner'}
          </button>
        </div>
      </form>

      <section className="admin-banners-list">
        <div className="admin-banners-list-header">
          <h2>All Banners</h2>
          <label className="admin-banner-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Banners" />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AdminBannerStatus | 'all')}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {bannersQuery.isLoading ? <LoadingState /> : null}
        {bannersQuery.isError ? <ErrorState /> : null}
        {!bannersQuery.isLoading && !bannersQuery.isError && (bannersQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState />
        ) : null}
        <div className="admin-banner-card-grid">
          {(bannersQuery.data?.items ?? []).map((banner) => (
            <article className="admin-banner-card" key={banner.id}>
              <div>
                <span className={`admin-banner-status ${banner.status}`}>{formatLabel(banner.status)}</span>
                <h3>{banner.title}</h3>
                <ProjectRichText className="admin-banner-card-message" html={banner.message} />
              </div>
              <dl>
                <div><dt>Style</dt><dd>{displayTypes.find((type) => type.value === banner.displayType)?.label ?? formatLabel(banner.displayType)}</dd></div>
                <div><dt>Type</dt><dd>{banner.bannerType === 'custom' ? banner.customType || 'Custom' : formatLabel(banner.bannerType)}</dd></div>
                <div><dt>Priority</dt><dd>{formatLabel(banner.priority)}</dd></div>
                <div><dt>Schedule</dt><dd>{formatDateTime(banner.startAt)} - {banner.endAt ? formatDateTime(banner.endAt) : 'Until inactive'}</dd></div>
              </dl>
              <div className="admin-banner-card-footer">
                <span>{banner.requireAcknowledgement ? <CheckCircle2 size={15} /> : <Bell size={15} />} {banner.requireAcknowledgement ? 'Read confirmation' : 'Dismissible'}</span>
                <div>
                  <button className="icon-button" onClick={() => handleEdit(banner)} title="Edit Banner" type="button"><Edit3 size={16} /></button>
                  <button
                    className="icon-button"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ bannerId: banner.id, status: banner.status === 'active' ? 'inactive' : 'active' })}
                    title={banner.status === 'active' ? 'Pause Banner' : 'Activate Banner'}
                    type="button"
                  >
                    <Play size={16} />
                  </button>
                  <button className="icon-button danger" disabled={archiveBanner.isPending} onClick={() => archiveBanner.mutate(banner.id)} title="Archive Banner" type="button">
                    <Archive size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
