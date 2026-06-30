import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Portal } from '../app/routeConfig';
import { StateBlock } from '../components/StateBlock';
import { apiGet, ApiClientError } from '../lib/supabaseApi';
import { useAuth } from './AuthProvider';

type ProtectedPortalRouteProps = {
  portal: Portal;
};

type StudentProfile = {
  active: boolean;
  email: string;
  fullName: string;
  id: string;
};

type AdminProfile = {
  email: string;
  fullName?: string;
  id: string;
  role: string;
  status: 'active';
};

function getProbePath(portal: Portal) {
  return portal === 'student' ? '/students/me' : '/admins/me';
}

export function ProtectedPortalRoute({ portal }: ProtectedPortalRouteProps) {
  const location = useLocation();
  const { accessToken, status } = useAuth();
  const profileQuery = useQuery({
    enabled: status === 'authenticated' && Boolean(accessToken),
    queryFn: () => apiGet<StudentProfile | AdminProfile>(getProbePath(portal), { accessToken: accessToken ?? undefined }),
    queryKey: ['portal-profile', portal, accessToken]
  });

  if (status === 'configuration-missing') {
    return (
      <main className="page-frame">
        <StateBlock title="Auth configuration missing" tone="warning">
          Portal sign-in is not configured for this environment yet.
        </StateBlock>
      </main>
    );
  }

  if (status === 'loading' || profileQuery.isLoading) {
    return (
      <main className="page-frame">
        <StateBlock title="Checking secure session">Validating your portal session with Supabase.</StateBlock>
      </main>
    );
  }

  if (status === 'unauthenticated' || !accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (profileQuery.error instanceof ApiClientError && profileQuery.error.status === 403) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (profileQuery.error instanceof ApiClientError && profileQuery.error.status === 401) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (profileQuery.error instanceof ApiClientError && profileQuery.error.status === 404) {
    return (
      <main className="page-frame">
        <StateBlock title={`${portal === 'student' ? 'Student' : 'Admin'} profile not linked`} tone="warning">
          Your session is valid, but this email is not linked to an active {portal} profile yet.{' '}
          <Link className="inline-link" to={portal === 'student' ? '/admin' : '/student'}>
            Try {portal === 'student' ? 'admin' : 'student'} portal
          </Link>
          .
        </StateBlock>
      </main>
    );
  }

  if (profileQuery.isError) {
    return (
      <main className="page-frame">
        <StateBlock title="Portal profile check failed" tone="warning">
          The session exists, but the Supabase profile check could not complete. Please retry after confirming the project configuration.
        </StateBlock>
      </main>
    );
  }

  return <Outlet />;
}
