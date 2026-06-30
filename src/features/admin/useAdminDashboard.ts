import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { JsonRecord } from '../student/useStudentDashboard';

export type AdminRole = 'owner' | 'admin' | 'operations' | 'mentor' | 'viewer';

export type AdminProfile = {
  email: string;
  fullName?: string;
  id: string;
  role: AdminRole;
  status: 'active';
};

export type AdminDashboard = {
  admin: AdminProfile;
  summary: JsonRecord;
};

export function useAdminProfile() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => apiGet<AdminProfile>('/admins/me', { accessToken: accessToken ?? undefined }),
    queryKey: ['admin-profile', accessToken]
  });
}

export function useAdminDashboard() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => apiGet<AdminDashboard>('/admins/dashboard', { accessToken: accessToken ?? undefined }),
    queryKey: ['admin-dashboard', accessToken],
    staleTime: 60_000
  });
}
