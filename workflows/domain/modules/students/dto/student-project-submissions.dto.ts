import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type StudentProjectSubmissionStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';

export class StudentProjectSubmissionsQueryDto extends PaginationQueryDto {
  search?: string;
  status: StudentProjectSubmissionStatus | 'all' = 'all';
  programKey?: string;
  cohortName?: string;
}

export class StudentProjectSubmissionListItemDto {
  id!: string;
  requestNumber?: string;
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
  submittedAt?: string;
  status!: StudentProjectSubmissionStatus;
}
