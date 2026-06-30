import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminProjectSubmissionStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';
export type AdminProjectSubmissionStatusFilter = AdminProjectSubmissionStatus | 'pending' | 'duplicates' | 'all';

export class AdminProjectSubmissionsQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminProjectSubmissionStatusFilter = 'pending';
  roleId?: string;
  programKey?: string;
  cohortName?: string;
  submittedDate?: string;
}

export class AdminProjectSubmissionListItemDto {
  id!: string;
  requestNumber?: string;
  studentId?: string;
  studentEmail!: string;
  studentName?: string;
  projectId?: string;
  projectTitle?: string;
  roleId?: string;
  roleName?: string;
  programKey?: string;
  cohortKey?: string;
  cohortName?: string;
  submissionLink?: string;
  remarks?: string;
  attemptNumber!: number;
  isRepeatSubmission!: boolean;
  previousRequestIds!: string[];
  previousRequestNumbers!: string[];
  duplicateGroupKey?: string;
  duplicateGroupCount!: number;
  submittedAt?: string;
  status!: AdminProjectSubmissionStatus;
}

export class AdminProjectSubmissionReviewDto {
  reviewNote?: string;
}
