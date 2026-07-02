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

export type PaginatedAdminResponse<TItem = JsonRecord> = {
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  items: TItem[];
  limit: number;
  page: number;
  total: number;
  totalPages?: number;
};

export type AdminDashboardDrilldowns = {
  certificateRequests: PaginatedAdminResponse;
  completedWorkshops: PaginatedAdminResponse;
  enrollmentRequests: PaginatedAdminResponse;
  failedPaymentOrders: PaginatedAdminResponse;
  paymentOrders: PaginatedAdminResponse;
  projectSubmissions: PaginatedAdminResponse;
  recordingCandidates: PaginatedAdminResponse;
  supportTickets: PaginatedAdminResponse;
  upcomingWorkshops: PaginatedAdminResponse;
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

export function useAdminDashboardDrilldowns() {
  const { accessToken } = useAuth();
  const authOptions = { accessToken: accessToken ?? undefined };
  const compactPage = { limit: 5 };

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: async (): Promise<AdminDashboardDrilldowns> => {
      const [
        certificateRequests,
        completedWorkshops,
        enrollmentRequests,
        failedPaymentOrders,
        paymentOrders,
        projectSubmissions,
        recordingCandidates,
        supportTickets,
        upcomingWorkshops
      ] = await Promise.all([
        apiGet<PaginatedAdminResponse>('/admins/certificate-requests', { ...authOptions, query: { ...compactPage, adminStatus: 'pending' } }),
        apiGet<PaginatedAdminResponse>('/admins/workshops', { ...authOptions, query: { ...compactPage, status: 'Completed' } }),
        apiGet<PaginatedAdminResponse>('/admins/enrollment-requests', { ...authOptions, query: compactPage }),
        apiGet<PaginatedAdminResponse>('/admins/payment-orders', { ...authOptions, query: { ...compactPage, status: 'failed' } }),
        apiGet<PaginatedAdminResponse>('/admins/payment-orders', { ...authOptions, query: compactPage }),
        apiGet<PaginatedAdminResponse>('/admins/project-submissions', { ...authOptions, query: { ...compactPage, status: 'pending' } }),
        apiGet<PaginatedAdminResponse>('/admins/recording-candidates', { ...authOptions, query: compactPage }),
        apiGet<PaginatedAdminResponse>('/admins/support-tickets', { ...authOptions, query: { ...compactPage, status: 'open' } }),
        apiGet<PaginatedAdminResponse>('/admins/workshops', { ...authOptions, query: { ...compactPage, status: 'Scheduled' } })
      ]);

      return {
        certificateRequests,
        completedWorkshops,
        enrollmentRequests,
        failedPaymentOrders,
        paymentOrders,
        projectSubmissions,
        recordingCandidates,
        supportTickets,
        upcomingWorkshops
      };
    },
    queryKey: ['admin-dashboard-drilldowns', accessToken],
    staleTime: 45_000
  });
}
