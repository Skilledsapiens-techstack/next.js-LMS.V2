import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Portal } from '../app/routeConfig';
import { StateBlock } from '../components/StateBlock';
import { apiGet, ApiClientError } from '../lib/supabaseApi';
import { useAuth } from './AuthProvider';
import { type AdminPermission, type AdminRoleKey } from './adminPermissions';

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
  permissions?: AdminPermission[];
  role: AdminRoleKey;
  status: 'active';
};

function getProbePath(portal: Portal) {
  return portal === 'student' ? '/students/me' : '/admins/me';
}

export function ProtectedPortalRoute({ portal }: ProtectedPortalRouteProps) {
  const location = useLocation();
  const { accessToken, signOut, status } = useAuth();
  const profileQuery = useQuery({
    enabled: status === 'authenticated' && Boolean(accessToken),
    queryFn: () => apiGet<StudentProfile | AdminProfile>(getProbePath(portal), { accessToken: accessToken ?? undefined }),
    queryKey: portal === 'admin' ? ['admin-profile', accessToken] : ['portal-profile', portal, accessToken],
    staleTime: portal === 'admin' ? 5 * 60 * 1000 : 0
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
        <StateBlock title="Checking secure session">Validating your portal access.</StateBlock>
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
        <StateBlock title="LMS access not linked" tone="warning">
          Your session is valid, but this email is not linked to an active LMS profile. Please contact support or sign out and use the correct registered email.
          <span className="state-block-actions">
            <button className="segmented-button" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </span>
        </StateBlock>
      </main>
    );
  }

  if (profileQuery.isError) {
    return (
      <main className="page-frame">
        <StateBlock title="Portal profile check failed" tone="warning">
          The session exists, but the profile check could not complete. Please refresh and try again.
        </StateBlock>
      </main>
    );
  }

  return <Outlet />;
}
