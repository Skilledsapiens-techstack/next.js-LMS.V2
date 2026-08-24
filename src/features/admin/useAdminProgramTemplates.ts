import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminProgramTemplateItem = {
  id: string;
  matchAliases?: string[];
  resourceIds: string[];
  topicTitle: string;
};

export type AdminProgramTemplateChapter = {
  id: string;
  items: AdminProgramTemplateItem[];
  title: string;
};

export type AdminProgramTemplateStatus = 'draft' | 'active' | 'inactive';
export type AdminProgramTemplateSource = 'sequence_manager' | 'admin_template';

export type AdminProgramTemplate = {
  chapters: AdminProgramTemplateChapter[];
  createdAt?: string;
  createdBy?: string | null;
  id: string;
  programKey: string;
  source: AdminProgramTemplateSource;
  status: AdminProgramTemplateStatus;
  updatedAt?: string;
  updatedBy?: string | null;
};

export type AdminProgramTemplatesQuery = {
  limit?: number;
  page?: number;
  programKey?: string;
  status?: AdminProgramTemplateStatus | 'all';
};

export type AdminProgramTemplatePayload = {
  chapters: AdminProgramTemplateChapter[];
  programKey: string;
  source?: AdminProgramTemplateSource;
  status?: AdminProgramTemplateStatus;
};

export function useAdminProgramTemplates(query: AdminProgramTemplatesQuery = {}) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 200;
  const page = query.page ?? 1;
  const programKey = query.programKey?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminProgramTemplate>>('/admins/program-templates', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          programKey,
          sort: 'program',
          status
        }
      }),
    queryKey: ['admin-program-templates', accessToken, page, limit, programKey, status],
    staleTime: 60_000
  });
}

export function useSaveAdminProgramTemplate() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminProgramTemplatePayload) =>
      apiPost<AdminProgramTemplate, AdminProgramTemplatePayload>('/admins/program-templates', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-program-templates'] });
    }
  });
}
