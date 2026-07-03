import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
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
  projectId?: string;
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
  roleId?: string;
  status: AdminProjectRoleStatus;
  updatedAt?: string;
};

export type AdminProjectWritePayload = {
  actionItems?: string;
  brief?: string;
  companyName?: string;
  deadline?: string | null;
  deliverables?: string;
  objectives?: string;
  programKey?: string;
  programKeys: string[];
  programName?: string;
  projectId?: string;
  projectRole?: string;
  resources?: string;
  roleId?: string;
  status: AdminProjectStatus;
  submissionLink?: string | null;
  title: string;
};

export type AdminProjectRoleWritePayload = {
  category?: string;
  name: string;
  programKey?: string;
  roleId?: string;
  status: AdminProjectRoleStatus;
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

export function useCreateAdminProject() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminProjectWritePayload) =>
      apiPost<AdminProject, AdminProjectWritePayload>('/admins/projects', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['student-projects'] });
    }
  });
}

export function useUpdateAdminProject() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, projectId }: { body: Partial<AdminProjectWritePayload>; projectId: string }) =>
      apiPatch<AdminProject, Partial<AdminProjectWritePayload>>(`/admins/projects/${projectId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['student-projects'] });
    }
  });
}

export function useUpdateAdminProjectStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, status }: { projectId: string; status: AdminProjectStatus }) =>
      apiPatch<AdminProject, { status: AdminProjectStatus }>(`/admins/projects/${projectId}/status`, {
        accessToken: accessToken ?? undefined,
        body: { status }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['student-projects'] });
    }
  });
}

export function useCreateAdminProjectRole() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminProjectRoleWritePayload) =>
      apiPost<AdminProjectRole, AdminProjectRoleWritePayload>('/admins/project-roles', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-project-roles'] })
  });
}

export function useUpdateAdminProjectRole() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, roleUuid }: { body: Partial<AdminProjectRoleWritePayload>; roleUuid: string }) =>
      apiPatch<AdminProjectRole, Partial<AdminProjectRoleWritePayload>>(`/admins/project-roles/${roleUuid}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-project-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
    }
  });
}

export function useUpdateAdminProjectRoleStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleUuid, status }: { roleUuid: string; status: AdminProjectRoleStatus }) =>
      apiPatch<AdminProjectRole, { status: AdminProjectRoleStatus }>(`/admins/project-roles/${roleUuid}/status`, {
        accessToken: accessToken ?? undefined,
        body: { status }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-project-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
    }
  });
}
