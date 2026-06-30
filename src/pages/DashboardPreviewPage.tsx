import { BookOpen, Database, FileCheck2, GraduationCap, Headphones, Lock, MessageCircle, Route, Users } from 'lucide-react';
import { Portal } from '../app/routeConfig';
import { StateBlock } from '../components/StateBlock';

type DashboardPreviewPageProps = {
  portal: Portal;
};

const studentCards = [
  { title: 'Dashboard', description: 'Profile, progress, announcements, upcoming sessions', icon: GraduationCap },
  { title: 'Community', description: 'Peer discussions, cohort updates, and moderated learner visibility', icon: MessageCircle },
  { title: 'Learning', description: 'Cohorts, resources, recordings, schedule', icon: BookOpen },
  { title: 'Outcomes', description: 'Projects, submissions, certificates, access', icon: FileCheck2 },
  { title: 'Support', description: 'Ticket list and public thread detail', icon: Headphones }
];

const adminCards = [
  { title: 'Operations', description: 'Students, enrollments, payments, access', icon: Users },
  { title: 'Community', description: 'Moderation view, flagged posts, and read-only activity overview', icon: MessageCircle },
  { title: 'Learning', description: 'Programs, cohorts, projects, resources', icon: BookOpen },
  { title: 'Reviews', description: 'Submissions, certificate requests, recordings', icon: FileCheck2 },
  { title: 'Support', description: 'Ticket queues and bounded detail views', icon: Headphones }
];

const migrationChecks = [
  ['Read-first UI', 'Every module starts with a query-only page and stable states.'],
  ['Supabase boundary', 'The browser does not speak to service-role credentials directly.'],
  ['Phase 6 gate', 'All mutations stay blocked until schema and RLS are approved.']
];

const qualityChecks = [
  ['Security posture', 'No service-role key in the browser runtime.'],
  ['Live app safety', 'The new portal remains isolated from the current live HTML app.'],
  ['Scale target', 'Screens are built for cacheable reads and predictable data loading.']
];

export function DashboardPreviewPage({ portal }: DashboardPreviewPageProps) {
  const cards = portal === 'student' ? studentCards : adminCards;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Phase 5 scaffold</span>
          <h1>{portal === 'student' ? 'Student portal foundation' : 'Admin portal foundation'}</h1>
          <p>The new LMS UI starts with a read-only shell that will be connected screen-by-screen to Supabases.</p>
        </div>
      </section>

      <div className="metric-grid">
        <article className="metric-tile">
          <BookOpen size={22} />
          <span>Mode</span>
          <strong>Read-only</strong>
        </article>
        <article className="metric-tile">
          <Database size={22} />
          <span>Backend</span>
          <strong>Supabase</strong>
        </article>
        <article className="metric-tile">
          <Lock size={22} />
          <span>Writes</span>
          <strong>Disabled</strong>
        </article>
        <article className="metric-tile">
          <Route size={22} />
          <span>Migration</span>
          <strong>Gradual</strong>
        </article>
      </div>

      <section className="module-grid">
        {cards.map(({ title, description, icon: Icon }) => (
          <article className="module-card" key={title}>
            <div className="module-card__icon">
              <Icon size={20} />
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="activity-grid" aria-label="Migration readiness checks">
        <div className="activity-panel">
          <h2>Build order discipline</h2>
          <div className="activity-list">
            {migrationChecks.map(([title, description]) => (
              <div className="activity-item" key={title}>
                <span className="activity-dot" aria-hidden="true" />
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="activity-panel">
          <h2>Non-negotiables</h2>
          <div className="activity-list">
            {qualityChecks.map(([title, description]) => (
              <div className="activity-item" key={title}>
                <span className="activity-dot" aria-hidden="true" />
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StateBlock title="Write actions are intentionally blocked">
        Project submissions, support replies, certificate approvals, enrollment activation, payment mutation, provider calls, and email dispatch remain deferred to Phase 6.
      </StateBlock>
    </div>
  );
}
