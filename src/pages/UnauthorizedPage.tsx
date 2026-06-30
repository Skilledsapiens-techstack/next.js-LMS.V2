import { Link } from 'react-router-dom';
import { StateBlock } from '../components/StateBlock';

export function UnauthorizedPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <h1>Access unavailable</h1>
        <StateBlock title="Role check failed" tone="warning">
          This page is shown when the current session cannot access the requested portal area.
        </StateBlock>
        <Link className="button-link" to="/login">
          Return to sign-in
        </Link>
      </section>
    </main>
  );
}
