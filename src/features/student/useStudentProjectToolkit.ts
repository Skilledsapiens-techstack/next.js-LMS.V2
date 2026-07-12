import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentProjectToolkitType = 'guidelines' | 'sow_link' | 'framework' | 'custom';

export type StudentProjectToolkitItem = {
  content?: string;
  id: string;
  itemType: StudentProjectToolkitType;
  linkLabel?: string;
  linkUrl?: string;
  programKeys: string[];
  sortOrder?: number;
  summary?: string;
  title: string;
  toolkitId: string;
};

export function useStudentProjectToolkit() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentProjectToolkitItem>>('/students/me/project-toolkit', {
        accessToken: accessToken ?? undefined,
        query: { limit: 100, page: 1 }
      }),
    queryKey: ['student-project-toolkit', accessToken],
    staleTime: 60_000
  });
}
