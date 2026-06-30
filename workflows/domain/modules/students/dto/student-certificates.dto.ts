import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type StudentCertificateStatus = 'draft' | 'issued';
export type StudentCertificateGenerationStatus = 'pending' | 'generating' | 'ready' | 'expired' | 'failed';
export type StudentCertificateType = 'leadership' | 'live_project';

export class StudentCertificatesQueryDto extends PaginationQueryDto {
  search?: string;
  status: StudentCertificateStatus | 'all' = 'all';
  generationStatus: StudentCertificateGenerationStatus | 'all' = 'all';
  certificateType: StudentCertificateType | 'all' = 'all';
}

export class StudentCertificateListItemDto {
  id!: string;
  certificateId!: string;
  certificateType!: StudentCertificateType;
  programKey?: string;
  programName?: string;
  cohortName?: string;
  projectId?: string;
  projectTitle?: string;
  issueDate!: string;
  status!: StudentCertificateStatus;
  generationStatus!: StudentCertificateGenerationStatus;
  createdAt?: string;
  updatedAt?: string;
}
