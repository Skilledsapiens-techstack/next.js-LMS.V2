import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class AdminStudentsQueryDto extends PaginationQueryDto {
  cohortName?: string;
  search?: string;
  status: 'active' | 'inactive' | 'all' = 'all';
}

export class AdminStudentListItemDto {
  id!: string;
  studentId?: string;
  fullName!: string;
  email!: string;
  altEmail?: string;
  phone?: string;
  collegeName?: string;
  cohortName?: string;
  programName?: string;
  programs?: string[];
  slot?: string;
  waGroup?: string;
  onboardingMailStatus?: string;
  enrolledDate?: string;
  trackRoleIds!: string[];
  active!: boolean;
  updatedAt?: string;
}

export class AdminStudentWriteDto {
  studentId?: string;
  fullName!: string;
  email!: string;
  altEmail?: string;
  phone?: string;
  collegeName?: string;
  cohortIds?: string[];
  cohortNames?: string[];
  programKeys?: string[];
  programNames?: string[];
  slot?: string;
  waGroup?: string;
  onboardingMailStatus?: string;
  active?: boolean;
  sendInvite?: boolean;
}

export class AdminStudentImportDto {
  students!: AdminStudentWriteDto[];
}

export class AdminStudentStatusUpdateDto {
  active!: boolean;
}

export class AdminStudentAttemptLimitDto {
  maxAttempts!: number;
  notes?: string;
}

export class AdminStudentAttemptLimitDtoOut {
  studentId!: string;
  studentEmail!: string;
  maxAttempts!: number;
  notes?: string;
  updatedAt?: string;
}

export class AdminStudentImportResultDto {
  created!: number;
  updated!: number;
  failed!: number;
}
