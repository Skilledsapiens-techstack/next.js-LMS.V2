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

type GuestProfile = {
  deactivatedAt?: string | null;
  emailVerifiedAt?: string | null;
  fullName: string;
  id: string;
  personalEmail: string;
};

type StudentDashboardCoreProbe = {
  dashboard: unknown;
  student: StudentProfile;
};

const preferredPortalStorageKey = 'skilled-sapiens-preferred-portal';

function getProbePath(portal: Portal) {
  return portal === 'student' ? '/students/me' : '/admins/me';
}

function getPreferredPortal() {
  if (typeof window === 'undefined') return null;
  const portal = window.localStorage.getItem(preferredPortalStorageKey);
  return portal === 'admin' || portal === 'student' ? portal : null;
}

export function ProtectedPortalRoute({ portal }: ProtectedPortalRouteProps) {
  const location = useLocation();
  const { accessToken, signOut, status } = useAuth();
  const isStudentDashboardPath = portal === 'student' && location.pathname.replace(/\/+$/, '') === '/student';
  const canShowStudentShell = portal === 'student' && status === 'authenticated' && Boolean(accessToken);
  const profileQuery = useQuery({
    enabled: status === 'authenticated' && Boolean(accessToken) && !isStudentDashboardPath,
    queryFn: () => apiGet<StudentProfile | AdminProfile>(getProbePath(portal), { accessToken: accessToken ?? undefined }),
    queryKey: portal === 'admin' ? ['admin-profile', accessToken] : ['student-profile', accessToken],
    staleTime: portal === 'admin' ? 5 * 60 * 1000 : 60 * 1000
  });
  const dashboardCoreQuery = useQuery({
    enabled: status === 'authenticated' && Boolean(accessToken) && isStudentDashboardPath,
    queryFn: () => apiGet<StudentDashboardCoreProbe>('/students/me/dashboard-core', { accessToken: accessToken ?? undefined }),
    queryKey: ['student-dashboard-core', accessToken],
    staleTime: 60 * 1000
  });
  const accessQuery = isStudentDashboardPath ? dashboardCoreQuery : profileQuery;
  const fallbackPortal: Portal = portal === 'student' ? 'admin' : 'student';
  const preferredPortal = getPreferredPortal();
  const shouldCheckFallbackPortal = accessQuery.error instanceof ApiClientError && accessQuery.error.status === 404;
  const fallbackProfileQuery = useQuery({
    enabled: status === 'authenticated' && Boolean(accessToken) && shouldCheckFallbackPortal,
    queryFn: () => apiGet<StudentProfile | AdminProfile>(getProbePath(fallbackPortal), { accessToken: accessToken ?? undefined }),
    queryKey: ['portal-fallback-profile', fallbackPortal, accessToken],
    retry: false,
    staleTime: 60 * 1000
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

  if (canShowStudentShell && accessQuery.isLoading) {
    return <Outlet />;
  }

  if (status === 'loading' || accessQuery.isLoading) {
    return (
      <main className="page-frame">
        <StateBlock title="Checking secure session">Validating your portal access.</StateBlock>
      </main>
    );
  }

  if (status === 'unauthenticated' || !accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (accessQuery.error instanceof ApiClientError && accessQuery.error.status === 403) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (accessQuery.error instanceof ApiClientError && accessQuery.error.status === 401) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (accessQuery.error instanceof ApiClientError && accessQuery.error.status === 404) {
    if (preferredPortal && preferredPortal !== portal) {
      return <Navigate to={`/${preferredPortal}`} replace />;
    }

    if (fallbackProfileQuery.isLoading) {
      return (
        <main className="page-frame">
          <StateBlock title="Finding your portal">Checking the right workspace for your account.</StateBlock>
        </main>
      );
    }

    if (fallbackProfileQuery.isSuccess) {
      return <Navigate to={`/${fallbackPortal}`} replace />;
    }

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

  if (accessQuery.isError) {
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

export function ProtectedGuestRoute() {
  const location = useLocation();
  const { accessToken, signOut, status } = useAuth();
  const profileQuery = useQuery({
    enabled: status === 'authenticated' && Boolean(accessToken),
    queryFn: () => apiGet<GuestProfile>('/guests/me', { accessToken: accessToken ?? undefined }),
    queryKey: ['guest-profile', accessToken],
    staleTime: 60 * 1000
  });

  if (status === 'configuration-missing') {
    return (
      <main className="page-frame">
        <StateBlock title="Auth configuration missing" tone="warning">
          Guest sign-in is not configured for this environment yet.
        </StateBlock>
      </main>
    );
  }

  if (status === 'loading' || profileQuery.isLoading) {
    return (
      <main className="page-frame">
        <StateBlock title="Checking secure session">Validating your guest access.</StateBlock>
      </main>
    );
  }

  if (status === 'unauthenticated' || !accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (profileQuery.error instanceof ApiClientError && profileQuery.error.status === 401) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (profileQuery.error instanceof ApiClientError && profileQuery.error.status === 403) {
    return (
      <main className="page-frame">
        <StateBlock title="Guest access not available yet" tone="warning">
          Please verify your email from the link sent during signup. If your access was deactivated, contact the Skilled Sapiens team.
          <span className="state-block-actions">
            <button className="segmented-button" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </span>
        </StateBlock>
      </main>
    );
  }

  if (profileQuery.error instanceof ApiClientError && profileQuery.error.status === 404) {
    return (
      <main className="page-frame">
        <StateBlock title="Guest profile not found" tone="warning">
          This login is not linked to a guest profile. Please use the same personal email used during free access signup.
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
        <StateBlock title="Guest profile check failed" tone="warning">
          The session exists, but the guest profile check could not complete. Please refresh and try again.
        </StateBlock>
      </main>
    );
  }

  return <Outlet />;
}
