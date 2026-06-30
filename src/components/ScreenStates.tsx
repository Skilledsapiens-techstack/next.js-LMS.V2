import { AlertCircle, EyeOff, Loader2, Lock, PlusCircle } from 'lucide-react';
import { ActionButton } from './ActionButton';

export function LoadingState() {
  return (
    <section className="screen-state">
      <Loader2 size={22} />
      <div>
        <h2>Loading</h2>
        <p>Please wait while we prepare this workspace.</p>
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
