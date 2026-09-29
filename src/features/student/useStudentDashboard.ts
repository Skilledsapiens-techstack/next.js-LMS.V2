import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/supabaseApi';
import { useAuth } from '../../auth/AuthProvider';

export type JsonRecord = Record<string, unknown>;

export type StudentProfile = {
  active: boolean;
  cohortName?: string;
  collegeName?: string;
  email: string;
  fullName: string;
  id: string;
  liveProjectRoleIds?: string[];
  liveProjectRoles?: string[];
  programName?: string;
  studentId?: string;
  trackRoleIds: string[];
};

export type StudentDashboard = {
  certificates: JsonRecord;
  dashboard: JsonRecord;
  guidanceContent?: JsonRecord;
  projects: JsonRecord;
  resources: JsonRecord;
  student: StudentProfile;
};

export type StudentDashboardCore = Pick<StudentDashboard, 'dashboard' | 'student'>;

export function useStudentProfile() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => apiGet<StudentProfile>('/students/me', { accessToken: accessToken ?? undefined }),
    queryKey: ['student-profile', accessToken],
    staleTime: 60_000
  });
}

export function useStudentDashboard() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => apiGet<StudentDashboard>('/students/me/dashboard', { accessToken: accessToken ?? undefined }),
    queryKey: ['student-dashboard', accessToken],
    staleTime: 60_000
  });
}

export function useStudentDashboardCore() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => apiGet<StudentDashboardCore>('/students/me/dashboard-core', { accessToken: accessToken ?? undefined }),
    queryKey: ['student-dashboard-core', accessToken],
    staleTime: 60_000
  });
}

export function useStudentGuidanceContent(options: { enabled?: boolean } = {}) {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken) && options.enabled !== false,
    queryFn: () =>
      apiGet<JsonRecord>('/students/me/guidance-content', {
        accessToken: accessToken ?? undefined,
        query: { limit: 10, page: 1 }
      }),
    queryKey: ['student-guidance-content', accessToken],
    staleTime: 60_000
  });
}
