import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentCertificateStatus = 'draft' | 'issued';
export type StudentCertificateGenerationStatus = 'pending' | 'generating' | 'ready' | 'expired' | 'failed';
export type StudentCertificateType = 'leadership' | 'live_project';

export type StudentCertificate = {
  certificateId: string;
  certificateType: StudentCertificateType;
  cohortName?: string;
  createdAt?: string;
  generationStatus: StudentCertificateGenerationStatus;
  id: string;
  issueDate: string;
  programKey?: string;
  programName?: string;
  projectId?: string;
  projectTitle?: string;
  status: StudentCertificateStatus;
  updatedAt?: string;
};

export type StudentCertificatesQuery = {
  certificateType?: StudentCertificateType | 'all';
  generationStatus?: StudentCertificateGenerationStatus | 'all';
  limit?: number;
  page?: number;
  search?: string;
  status?: StudentCertificateStatus | 'all';
};

export function useStudentCertificates(query: StudentCertificatesQuery) {
  const { accessToken } = useAuth();
  const certificateType = query.certificateType ?? 'all';
  const generationStatus = query.generationStatus ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentCertificate>>('/students/me/certificates', {
        accessToken: accessToken ?? undefined,
        query: {
          certificateType,
          generationStatus,
          limit,
          page,
          search,
          status
        }
      }),
    queryKey: ['student-certificates', accessToken, page, limit, status, generationStatus, certificateType, search],
    staleTime: 60_000
  });
}
