import { useMemo, type CSSProperties } from 'react';
import { AlertCircle, EyeOff, Lock, PlusCircle } from 'lucide-react';
import { ActionButton } from './ActionButton';

const learningPathMessages = [
  ['Start Small', 'Stay Curious', 'Keep Practicing', 'Grow Daily'],
  ['Show Up', 'Learn Today', 'Try Again', 'Move Forward'],
  ['Begin Here', 'Build Skills', 'Gain Confidence', 'Go Further'],
  ['One Step', 'One Lesson', 'One Skill', 'One Win'],
  ['Stay Ready', 'Keep Learning', 'Build Momentum', 'Reach Higher'],
  ['Find Focus', 'Learn Deeply', 'Practice Often', 'Rise Strong'],
  ['Start Fresh', 'Learn More', 'Do Better', 'Go Higher'],
] as const;

export function LoadingState() {
  const learningPath = useMemo(() => {
    return learningPathMessages[Math.floor(Math.random() * learningPathMessages.length)];
  }, []);

  return (
    <section aria-busy="true" aria-live="polite" className="screen-state screen-state--loading" role="status">
      <div className="screen-state-loading-copy">
        <h2>Building your learning path</h2>
        <p>Please wait while we connect your workspace.</p>
      </div>
      <div className="screen-state-learning-path" aria-hidden="true">
        {learningPath.map((label, index) => (
          <span className="screen-state-learning-path__step" key={label} style={{ '--step-index': index } as CSSProperties}>
            <span>{label}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

export function EmptyState() {
  return (
    <section className="screen-state">
      <EyeOff size={22} />
      <div>
        <h2>No records yet</h2>
        <p>There are no matching records to show right now.</p>
      </div>
    </section>
  );
}

export function ErrorState() {
  return (
    <section className="screen-state screen-state--warning">
      <AlertCircle size={22} />
      <div>
        <h2>Unable to load</h2>
        <p>Please refresh the page. If the issue continues, contact support.</p>
      </div>
    </section>
  );
}

export function LockedState() {
  return (
    <section className="screen-state">
      <Lock size={22} />
      <div>
        <h2>Locked content</h2>
        <p>This content is available only for eligible programs, cohorts, or account roles.</p>
      </div>
    </section>
  );
}

export function DisabledWriteAction() {
  return <ActionButton disabled icon={PlusCircle} label="Coming soon" tone="disabled" title="This action is not available yet" />;
}
