import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { type AdminPermission } from '../../auth/adminPermissions';
import { apiInvokeFunction } from '../../lib/supabaseApi';

export type AdminUserRole = 'admin' | 'moderator' | 'super_admin';
export type AdminUserStatus = 'active' | 'inactive';

export type AdminUser = {
  createdAt?: string | null;
  email: string;
  fullName: string;
  id: string;
  permissions?: AdminPermission[] | null;
  role: AdminUserRole;
  status: AdminUserStatus;
  updatedAt?: string | null;
};

type AdminUsersListResult = {
  admins: AdminUser[];
};

export type AdminUserSavePayload = {
  email: string;
  fullName: string;
  permissions?: AdminPermission[] | null;
  role: AdminUserRole;
  status: AdminUserStatus;
};

export function useAdminUsers() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiInvokeFunction<AdminUsersListResult, { action: string }>('admin-users', {
        accessToken: accessToken ?? undefined,
        body: { action: 'list' }
      }),
    queryKey: ['admin-users', accessToken],
    staleTime: 30_000
  });
}

export function useSaveAdminUser() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminUserSavePayload) =>
      apiInvokeFunction<{ admin: AdminUser }, AdminUserSavePayload & { action: string }>('admin-users', {
        accessToken: accessToken ?? undefined,
        body: { ...body, action: 'save' }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
    }
  });
}

export function useDeactivateAdminUser() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adminId: string) =>
      apiInvokeFunction<{ admin: AdminUser }, { action: string; adminId: string }>('admin-users', {
        accessToken: accessToken ?? undefined,
        body: { action: 'deactivate', adminId }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
    }
  });
}
