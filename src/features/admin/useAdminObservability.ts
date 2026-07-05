import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { JsonRecord } from '../student/useStudentDashboard';
import { AdminProfile, PaginatedAdminResponse } from './useAdminDashboard';

export type ObservabilitySummary = {
  activeUsers: {
    studentsLastFiveMinutes: number;
    studentsLastHour: number;
    studentsToday: number;
    totalLastHour: number;
  };
  meetings: {
    cancelledThisWeek: number;
    createdToday: number;
    recordingsAddedToday: number;
    scheduledThisWeek: number;
    withoutRecordings: number;
  };
  operations: {
    failedAdminLoginsToday: number;
    openAlerts: number;
    recentAdminActions: number;
    recentErrors: number;
  };
  recentStudents: JsonRecord[];
  recentlyChangedMeetings: JsonRecord[];
};

export type AdminObservability = {
  admin: AdminProfile;
  alerts: PaginatedAdminResponse<JsonRecord>;
  auditLogs: PaginatedAdminResponse<JsonRecord>;
  eventLogs: PaginatedAdminResponse<JsonRecord>;
  summary: ObservabilitySummary;
};

export type AdminObservabilityQuery = {
  actionType?: string;
  limit?: number;
  module?: string;
  page?: number;
  search?: string;
  severity?: string;
};

export function useAdminObservability(query: AdminObservabilityQuery = {}) {
  const { accessToken } = useAuth();
  const actionType = query.actionType ?? 'all';
  const limit = query.limit ?? 20;
  const module = query.module ?? 'all';
  const page = query.page ?? 1;
  const search = query.search?.trim() ?? '';
  const severity = query.severity ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<AdminObservability>('/admins/observability', {
        accessToken: accessToken ?? undefined,
        query: {
          actionType,
          limit,
          module,
          page,
          search,
          severity
        }
      }),
    queryKey: ['admin-observability', accessToken, actionType, limit, module, page, search, severity],
    staleTime: 60_000
  });
}
