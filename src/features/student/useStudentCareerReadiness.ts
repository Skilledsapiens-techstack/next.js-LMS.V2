import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type CareerReadinessCategory = string;

export type CareerReadinessLinkButton = {
  label: string;
  url: string;
};

export type StudentCareerReadinessContent = {
  availableOnPulse?: boolean;
  category: CareerReadinessCategory;
  cohortNames: string[];
  content?: string;
  description?: string;
  id: string;
  isPublished: boolean;
  linkButtons?: CareerReadinessLinkButton[];
  linkLabel?: string;
  linkUrl?: string;
  pulseCategory?: string | null;
  pulseFeatured?: boolean;
  pulseSummary?: string | null;
  pulseVisibility?: 'all' | 'college' | 'program';
  programKeys: string[];
  sectionTitle?: string;
  sortOrder: number;
  title: string;
  updatedAt?: string;
};

export type StudentCareerReadinessQuery = {
  category?: CareerReadinessCategory | '';
  limit?: number;
  page?: number;
  pulse?: boolean;
  search?: string;
};

export function useStudentCareerReadiness(query: StudentCareerReadinessQuery) {
  const { accessToken } = useAuth();
  const category = query.category ?? '';
  const limit = query.limit ?? 100;
  const page = query.page ?? 1;
  const search = query.search?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentCareerReadinessContent>>('/students/me/career-readiness', {
        accessToken: accessToken ?? undefined,
        query: {
          category,
          limit,
          page,
          pulse: query.pulse ? 'true' : undefined,
          search
        }
      }),
    queryKey: ['student-career-readiness', accessToken, page, limit, category, query.pulse === true, search],
    staleTime: 60_000
  });
}
