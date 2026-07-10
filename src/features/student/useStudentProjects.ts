import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentProjectTask = {
  description?: string;
  sectionType?: string;
  title: string;
};

export type StudentProjectDocument = {
  description?: string;
  link?: string;
  label?: string;
  title: string;
  type?: string;
};

export type StudentProjectDeliverable = {
  description?: string;
  format?: string;
  note?: string;
  title: string;
};

export type StudentProject = {
  brief?: string;
  companyName?: string;
  deadline?: string;
  deliverables: StudentProjectDeliverable[];
  documents: StudentProjectDocument[];
  id: string;
  objectives?: string;
  projectId?: string;
  programKey?: string;
  programKeys: string[];
  programName?: string;
  projectRole?: string;
  roleId?: string;
  tasks: StudentProjectTask[];
  title: string;
  updatedAt?: string;
};

export type StudentProjectsQuery = {
  limit?: number;
  page?: number;
  programKey?: string;
  roleId?: string;
  search?: string;
};

export function useStudentProjects(query: StudentProjectsQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const programKey = query.programKey?.trim();
  const roleId = query.roleId?.trim();
  const search = query.search?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentProject>>('/students/me/projects', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          programKey,
          roleId,
          search
        }
      }),
    queryKey: ['student-projects', accessToken, page, limit, programKey, roleId, search],
    staleTime: 60_000
  });
}
