import { ArrowLeft, BookOpen, CalendarDays, Eye, FileText, GraduationCap, Lock, ShieldCheck, Video } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { AdminStudentPreviewItem, useAdminStudentPreview } from '../features/admin/useAdminStudentPreview';

const moduleCards = [
  { countKey: 'schedule', icon: CalendarDays, label: 'Upcoming Workshops' },
  { countKey: 'recordings', icon: Video, label: 'Watch Recordings' },
  { countKey: 'resources', icon: BookOpen, label: 'Resource Library' },
  { countKey: 'projects', icon: GraduationCap, label: 'Live Project Hub' },
  { countKey: 'certificates', icon: FileText, label: 'Certificates' }
] as const;

type PreviewModuleKey = (typeof moduleCards)[number]['countKey'];

export function AdminStudentPreviewPage() {
  const { studentId } = useParams();
  const previewQuery = useAdminStudentPreview(studentId);
  const preview = previewQuery.data;

  if (previewQuery.isLoading) {
    return (
      <main className="page-frame admin-student-preview-page">
        <PageHeader description="Loading read-only student preview." eyebrow="Admin preview" title="Student Preview" />
        <LoadingState />
      </main>
    );
  }

  if (previewQuery.isError || !preview) {
    return (
      <main className="page-frame admin-student-preview-page">
        <PageHeader
          actions={
            <Link className="segmented-button" to="/admin/students">
              <ArrowLeft size={16} />
              Back to Students
            </Link>
          }
          description="This student preview could not be loaded."
          eyebrow="Admin preview"
          title="Preview unavailable"
        />
        <ErrorState />
      </main>
    );
  }

  const student = preview.student;
  const cohorts = preview.cohorts.length > 0 ? preview.cohorts : ['No cohort mapped'];
  const programs = preview.programs.length > 0 ? preview.programs : student.programName ? [student.programName] : ['No program mapped'];
  const roles = student.liveProjectRoles?.length ? student.liveProjectRoles : [];

  return (
    <main className="page-frame admin-student-preview-page">
      <PageHeader
        actions={
          <Link className="segmented-button" to="/admin/students">
            <ArrowLeft size={16} />
            Exit Preview
          </Link>
        }
        description="Read-only student-side context for admin verification. No student session is created."
        eyebrow="Admin preview"
        title={`Preview: ${student.fullName}`}
      />

      <section className="admin-student-preview-alert" aria-label="Read-only preview mode">
        <ShieldCheck size={22} />
        <div>
          <strong>Read-only preview mode</strong>
          <span>Write actions are disabled and this does not log in as the student.</span>
        </div>
      </section>

      <section className="admin-student-preview-profile" aria-label="Learner profile preview">
        <div>
          <span className="section-eyebrow">Learner Profile</span>
          <h2>{student.fullName}</h2>
          <p>{student.email}</p>
        </div>
        <StatusBadge tone={student.active ? 'safe' : 'warning'}>{student.active ? 'Active' : 'Inactive'}</StatusBadge>
        <dl>
          <div>
            <dt>Student ID</dt>
            <dd>{student.studentId || '-'}</dd>
          </div>
          <div>
            <dt>College</dt>
            <dd>{student.collegeName || '-'}</dd>
          </div>
          <div>
            <dt>Program</dt>
            <dd>{programs.join(', ')}</dd>
          </div>
          <div>
            <dt>Cohort</dt>
            <dd>{cohorts.join(', ')}</dd>
          </div>
        </dl>
        {roles.length > 0 ? (
          <div className="admin-student-preview-chips" aria-label="Live project roles">
            <span>Live Project Role</span>
            {roles.map((role) => (
              <strong key={role}>{role}</strong>
            ))}
          </div>
        ) : null}
      </section>

      <section className="admin-student-preview-modules" aria-label="Student module access summary">
        <div className="admin-student-preview-section-heading">
          <div>
            <span className="section-eyebrow">Student View</span>
            <h2>Visible module snapshot</h2>
          </div>
          <span>Read-only content preview</span>
        </div>
        <div className="admin-student-preview-grid">
          {moduleCards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="admin-student-preview-card" key={card.countKey}>
                <Icon size={22} />
                <div>
                  <span>{card.label}</span>
                  <strong>{preview.counts[card.countKey]}</strong>
                </div>
              </article>
            );
          })}
        </div>
        <div className="admin-student-preview-content-grid">
          {moduleCards.map((card) => {
            const Icon = card.icon;
            const module = preview.modules?.[card.countKey];
            return (
              <article className="admin-student-preview-list-card" key={`${card.countKey}-list`}>
                <header>
                  <div>
                    <Icon size={18} />
                    <h3>{card.label}</h3>
                  </div>
                  <span>{module?.total ?? preview.counts[card.countKey]}</span>
                </header>
                {module?.items.length ? (
                  <div className="admin-student-preview-list">
                    {module.items.map((item) => (
                      <PreviewListItem item={item} key={`${card.countKey}-${item.id}`} moduleKey={card.countKey} />
                    ))}
                  </div>
                ) : (
                  <p className="admin-student-preview-empty">No visible items in this module for this student.</p>
                )}
                {module && module.total > module.items.length ? <small>Showing first {module.items.length} of {module.total} visible items.</small> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-student-preview-readonly" aria-label="Preview restrictions">
        <Lock size={20} />
        <div>
          <strong>Write actions are intentionally unavailable here.</strong>
          <p>Submissions, support replies, recording opens, resource opens, and certificate actions stay disabled in this admin preview workspace.</p>
        </div>
        <Eye size={20} />
      </section>
    </main>
  );
}

function PreviewListItem({ item, moduleKey }: { item: AdminStudentPreviewItem; moduleKey: PreviewModuleKey }) {
  const statusTone = item.locked ? 'warning' : moduleKey === 'certificates' ? 'neutral' : 'safe';

  return (
    <div className="admin-student-preview-list-item">
      <div>
        <div className="admin-student-preview-list-item__topline">
          {item.eyebrow ? <span>{formatPreviewLabel(item.eyebrow)}</span> : null}
          {item.status ? <StatusBadge tone={statusTone}>{formatPreviewLabel(item.status)}</StatusBadge> : null}
        </div>
        <strong>{item.title}</strong>
        {item.meta.length > 0 ? (
          <div className="admin-student-preview-list-item__meta">
            {item.meta.map((meta) => (
              <span key={meta}>{formatPreviewLabel(meta)}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatPreviewLabel(value: string) {
  return value.replace(/_/g, ' ');
}
