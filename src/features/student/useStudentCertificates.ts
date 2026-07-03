import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiInvokeFunction } from '../../lib/supabaseApi';
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
  pdfExpiresAt?: string;
  pdfGeneratedAt?: string;
  programKey?: string;
  programName?: string;
  projectId?: string;
  projectTitle?: string;
  status: StudentCertificateStatus;
  updatedAt?: string;
};

export type StudentCertificatePdfResult = {
  message: string;
  results: Array<{
    certificate?: StudentCertificate;
    certificateId?: string;
    error?: string;
    expiresAt?: string;
    signedUrl?: string;
    status: 'generated' | 'reused' | 'failed';
  }>;
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

export function useGenerateStudentCertificatePdf() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ certificateId, force = false }: { certificateId: string; force?: boolean }) =>
      apiInvokeFunction<StudentCertificatePdfResult, { certificateId: string; force: boolean }>('certificate-issuance', {
        accessToken: accessToken ?? undefined,
        body: { certificateId, force }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student-certificates'] })
  });
}
