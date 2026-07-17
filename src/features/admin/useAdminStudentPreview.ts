import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';

export type AdminStudentPreviewItem = {
  eyebrow?: string;
  id: string;
  locked?: boolean;
  meta: string[];
  status?: string;
  title: string;
};

export type AdminStudentPreviewModule = {
  items: AdminStudentPreviewItem[];
  total: number;
};

export type AdminStudentPreview = {
  cohorts: string[];
  counts: {
    certificates: number;
    projects: number;
    recordings: number;
    resources: number;
    schedule: number;
  };
  generatedAt?: string;
  modules?: {
    certificates: AdminStudentPreviewModule;
    projects: AdminStudentPreviewModule;
    recordings: AdminStudentPreviewModule;
    resources: AdminStudentPreviewModule;
    schedule: AdminStudentPreviewModule;
  };
  previewMode: true;
  programs: string[];
  student: {
    active: boolean;
    collegeName?: string;
    email: string;
    fullName: string;
    id: string;
    liveProjectRoles?: string[];
    programName?: string;
    studentId?: string;
  };
};

export function useAdminStudentPreview(studentId?: string) {
  const { accessToken } = useAuth();
  const normalizedStudentId = studentId?.trim();

  return useQuery({
    enabled: Boolean(accessToken && normalizedStudentId),
    queryFn: () =>
      apiGet<AdminStudentPreview>(`/admins/students/${encodeURIComponent(normalizedStudentId ?? '')}/preview`, {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['admin-student-preview', accessToken, normalizedStudentId],
    staleTime: 30_000
  });
}
