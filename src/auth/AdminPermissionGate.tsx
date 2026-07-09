import { useQuery } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { MODULE_VIEW_PERMISSIONS, hasAdminPermission, type AdminPermission } from './adminPermissions';
import { apiGet } from '../lib/supabaseApi';
import { useAuth } from './AuthProvider';
import { StateBlock } from '../components/StateBlock';

type AdminProfile = {
  permissions?: AdminPermission[];
  role: string;
};

type AdminPermissionGateProps = {
  children: ReactNode;
  moduleId: string;
};

export function AdminPermissionGate({ children, moduleId }: AdminPermissionGateProps) {
  const location = useLocation();
  const { accessToken } = useAuth();
  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => apiGet<AdminProfile>('/admins/me', { accessToken: accessToken ?? undefined }),
    queryKey: ['admin-profile', accessToken],
    staleTime: 5 * 60 * 1000
  });
  const permission = MODULE_VIEW_PERMISSIONS[moduleId];

  if (profileQuery.isLoading) {
    return (
      <div className="page-stack">
        <StateBlock title="Checking admin role">Validating your module access.</StateBlock>
      </div>
    );
  }

  if (profileQuery.isError || !hasAdminPermission(profileQuery.data?.role, permission, profileQuery.data?.permissions)) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
