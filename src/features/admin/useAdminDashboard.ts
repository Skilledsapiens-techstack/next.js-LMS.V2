import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { hasAdminPermission, type AdminPermission, type AdminRoleKey } from '../../auth/adminPermissions';
import { apiGet, ApiClientError } from '../../lib/supabaseApi';
import { JsonRecord } from '../student/useStudentDashboard';

export type AdminProfile = {
  email: string;
  fullName?: string;
  id: string;
  permissions?: AdminPermission[];
  role: AdminRoleKey;
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

const emptyPaginatedAdminResponse: PaginatedAdminResponse = {
  hasNextPage: false,
  hasPreviousPage: false,
  items: [],
  limit: 5,
  page: 1,
  total: 0,
  totalPages: 1
};

async function safeAdminDrilldown<T>(request: Promise<PaginatedAdminResponse<T>>) {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 403) return emptyPaginatedAdminResponse as PaginatedAdminResponse<T>;
    throw error;
  }
}

function stringFromItem(item: JsonRecord, key: string) {
  const value = item[key];
  return typeof value === 'string' ? value : '';
}

function scheduledWorkshopTime(item: JsonRecord) {
  const date = stringFromItem(item, 'date');
  const time = stringFromItem(item, 'time');
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})/);

  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const hour = timeMatch ? Number(timeMatch[1]) : 0;
    const minute = timeMatch ? Number(timeMatch[2]) : 0;
    const scheduledAt = new Date(Number(year), Number(month) - 1, Number(day), hour, minute).getTime();
    return Number.isFinite(scheduledAt) ? scheduledAt : Number.POSITIVE_INFINITY;
  }

  const parsed = date ? new Date(date).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function compactUpcomingWorkshops(response: PaginatedAdminResponse): PaginatedAdminResponse {
  return {
    ...response,
    items: [...response.items]
      .sort((left, right) => {
        const scheduledDiff = scheduledWorkshopTime(left) - scheduledWorkshopTime(right);
        if (scheduledDiff !== 0) return scheduledDiff;
        return stringFromItem(left, 'title').localeCompare(stringFromItem(right, 'title'));
      })
      .slice(0, 5),
    limit: 5
  };
}

export function useAdminProfile() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => apiGet<AdminProfile>('/admins/me', { accessToken: accessToken ?? undefined }),
    queryKey: ['admin-profile', accessToken],
    staleTime: 5 * 60 * 1000
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
  const profileQuery = useAdminProfile();
  const role = profileQuery.data?.role;
  const permissions = profileQuery.data?.permissions;
  const upcomingWorkshopPage = { limit: 50 };

  return useQuery({
    enabled: Boolean(accessToken && role),
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
        hasAdminPermission(role, 'admin.certificates.view', permissions)
          ? safeAdminDrilldown(apiGet<PaginatedAdminResponse>('/admins/certificate-requests', { ...authOptions, query: { ...compactPage, adminStatus: 'pending' } }))
          : emptyPaginatedAdminResponse,
        hasAdminPermission(role, 'admin.meetings.view', permissions)
          ? safeAdminDrilldown(apiGet<PaginatedAdminResponse>('/admins/workshops', { ...authOptions, query: { ...compactPage, status: 'Completed' } }))
          : emptyPaginatedAdminResponse,
        hasAdminPermission(role, 'admin.enrollments.view', permissions)
          ? safeAdminDrilldown(apiGet<PaginatedAdminResponse>('/admins/enrollment-requests', { ...authOptions, query: compactPage }))
          : emptyPaginatedAdminResponse,
        hasAdminPermission(role, 'admin.payments.view', permissions)
          ? safeAdminDrilldown(apiGet<PaginatedAdminResponse>('/admins/payment-orders', { ...authOptions, query: { ...compactPage, status: 'failed' } }))
          : emptyPaginatedAdminResponse,
        hasAdminPermission(role, 'admin.payments.view', permissions)
          ? safeAdminDrilldown(apiGet<PaginatedAdminResponse>('/admins/payment-orders', { ...authOptions, query: compactPage }))
          : emptyPaginatedAdminResponse,
        hasAdminPermission(role, 'admin.submissions.view', permissions)
          ? safeAdminDrilldown(apiGet<PaginatedAdminResponse>('/admins/project-submissions', { ...authOptions, query: { ...compactPage, status: 'pending' } }))
          : emptyPaginatedAdminResponse,
        hasAdminPermission(role, 'admin.recordings.view', permissions)
          ? safeAdminDrilldown(apiGet<PaginatedAdminResponse>('/admins/recording-candidates', { ...authOptions, query: compactPage }))
          : emptyPaginatedAdminResponse,
        hasAdminPermission(role, 'admin.support.view', permissions)
          ? safeAdminDrilldown(apiGet<PaginatedAdminResponse>('/admins/support-tickets', { ...authOptions, query: { ...compactPage, status: 'open' } }))
          : emptyPaginatedAdminResponse,
        hasAdminPermission(role, 'admin.meetings.view', permissions)
          ? safeAdminDrilldown(apiGet<PaginatedAdminResponse>('/admins/workshops', { ...authOptions, query: { ...upcomingWorkshopPage, status: 'Scheduled' } }))
          : emptyPaginatedAdminResponse
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
        upcomingWorkshops: compactUpcomingWorkshops(upcomingWorkshops)
      };
    },
    queryKey: ['admin-dashboard-drilldowns', accessToken, role, permissions],
    staleTime: 45_000
  });
}
