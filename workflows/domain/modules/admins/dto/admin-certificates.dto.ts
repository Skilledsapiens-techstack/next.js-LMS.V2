import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminCertificateStatus = 'draft' | 'issued' | 'revoked';
export type AdminCertificateGenerationStatus = 'pending' | 'generating' | 'ready' | 'expired' | 'failed';
export type AdminCertificateType = 'leadership' | 'live_project';
export type AdminCertificateReviewStatus = 'pending' | 'approved' | 'rejected';
export type AdminCertificateRequestAdminStatus = AdminCertificateReviewStatus | 'issued';

export class AdminCertificatesQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminCertificateStatus | 'all' = 'all';
  generationStatus: AdminCertificateGenerationStatus | 'all' = 'all';
  certificateType: AdminCertificateType | 'all' = 'all';
}

export class AdminCertificateListItemDto {
  id!: string;
  certificateId!: string;
  certificateType!: AdminCertificateType;
  studentEmail!: string;
  studentName!: string;
  programKey?: string;
  programName?: string;
  cohortName?: string;
  projectId?: string;
  projectTitle?: string;
  issueDate!: string;
  status!: AdminCertificateStatus;
  generationStatus!: AdminCertificateGenerationStatus;
  issuedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class AdminCertificateRequestsQueryDto extends PaginationQueryDto {
  search?: string;
  moderatorStatus: AdminCertificateReviewStatus | 'all' = 'all';
  adminStatus: AdminCertificateRequestAdminStatus | 'all' = 'all';
}

export class AdminCertificateRequestListItemDto {
  id!: string;
  requestId!: string;
  requestType!: 'live_project';
  studentEmail!: string;
  studentName!: string;
  projectId!: string;
  projectTitle?: string;
  projectRole!: string;
  programKey?: string;
  cohortName?: string;
  submittedAt!: string;
  moderatorStatus!: AdminCertificateReviewStatus;
  moderatorEmail?: string;
  moderatorReviewedAt?: string;
  adminStatus!: AdminCertificateRequestAdminStatus;
  adminEmail?: string;
  adminReviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
