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
  programName?: string;
  studentId?: string;
  trackRoleIds: string[];
};

export type StudentDashboard = {
  certificates: JsonRecord;
  dashboard: JsonRecord;
  projects: JsonRecord;
  resources: JsonRecord;
  student: StudentProfile;
};

export function useStudentProfile() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => apiGet<StudentProfile>('/students/me', { accessToken: accessToken ?? undefined }),
    queryKey: ['student-profile', accessToken]
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
