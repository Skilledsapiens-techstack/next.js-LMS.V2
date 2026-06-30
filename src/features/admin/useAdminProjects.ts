import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminProjectStatus = 'active' | 'inactive';
export type AdminProjectRoleStatus = 'active' | 'inactive';

export type AdminProjectTask = {
  description?: string;
  title: string;
};

export type AdminProjectDocument = {
  description?: string;
  link?: string;
  title: string;
  type?: string;
};

export type AdminProjectDeliverable = {
  format?: string;
  note?: string;
  title: string;
};

export type AdminProject = {
  brief?: string;
  companyName?: string;
  deadline?: string;
  deliverables: AdminProjectDeliverable[];
  documents: AdminProjectDocument[];
  id: string;
  objectives?: string;
  programKey?: string;
  programKeys: string[];
  programName?: string;
  projectRole?: string;
  roleId?: string;
  status: AdminProjectStatus;
  submissionLink?: string;
  tasks: AdminProjectTask[];
  title: string;
  updatedAt?: string;
};

export type AdminProjectRole = {
  category?: string;
  id: string;
  name: string;
  programKey?: string;
  status: AdminProjectRoleStatus;
  updatedAt?: string;
};

export type AdminProjectsQuery = {
  enabled?: boolean;
  limit?: number;
  page?: number;
  programKey?: string;
  roleId?: string;
  search?: string;
  status?: AdminProjectStatus | 'all';
};

export type AdminProjectRolesQuery = {
  enabled?: boolean;
  limit?: number;
  page?: number;
  programKey?: string;
  search?: string;
  status?: AdminProjectRoleStatus | 'all';
};

export function useAdminProjects(query: AdminProjectsQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const programKey = query.programKey?.trim();
  const roleId = query.roleId?.trim();
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminProject>>('/admins/projects', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          programKey,
          roleId,
          search,
          status
        }
      }),
    queryKey: ['admin-projects', accessToken, page, limit, status, roleId, programKey, search],
    staleTime: 60_000
  });
}

export function useAdminProjectRoles(query: AdminProjectRolesQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const programKey = query.programKey?.trim();
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminProjectRole>>('/admins/project-roles', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          programKey,
          search,
          status
        }
      }),
    queryKey: ['admin-project-roles', accessToken, page, limit, status, programKey, search],
    staleTime: 60_000
  });
}
