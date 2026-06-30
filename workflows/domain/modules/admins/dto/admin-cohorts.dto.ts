import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { JsonValue } from '../../../common/types/json.types';

export type AdminCohortStatus = 'upcoming' | 'active' | 'completed' | 'inactive';
export type AdminCohortSort = 'name' | 'students_desc' | 'students_asc' | 'start_newest' | 'start_oldest' | 'program';

export class AdminCohortsQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminCohortStatus | 'all' = 'all';
  @Matches(/^[a-zA-Z0-9_-]+$/)
  program?: string;
  sort?: AdminCohortSort = 'name';
}

export class AdminCohortListItemDto {
  id!: string;
  cohortId?: string;
  name!: string;
  programKey?: string;
  domainKey?: string;
  status!: AdminCohortStatus;
  startDate?: string;
  endDate?: string;
  studentCount!: number;
  waLink?: string;
  waGroupName?: string;
  googleGroup?: string;
  selfPaced!: boolean;
  selfPacedSessions!: JsonValue[];
  selfPacedResources!: JsonValue[];
  updatedAt?: string;
}

export class AdminCreateCohortDto {
  cohortId?: string;
  name!: string;
  @Matches(/^[a-zA-Z0-9_-]+$/)
  programKey!: string;
  @Matches(/^[a-zA-Z0-9_-]+$/)
  domainKey?: string;
  status!: AdminCohortStatus;
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
  studentCount?: number;
  waLink?: string;
  waGroupName?: string;
  googleGroup?: string;
  selfPaced?: boolean;
  selfPacedSessions?: JsonValue[];
  selfPacedResources?: JsonValue[];
}

export class AdminUpdateCohortDto {
  cohortId?: string;
  name?: string;
  @Matches(/^[a-zA-Z0-9_-]+$/)
  programKey?: string;
  @Matches(/^[a-zA-Z0-9_-]+$/)
  domainKey?: string;
  status?: AdminCohortStatus;
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
  studentCount?: number;
  waLink?: string;
  waGroupName?: string;
  googleGroup?: string;
  selfPaced?: boolean;
  selfPacedSessions?: JsonValue[];
  selfPacedResources?: JsonValue[];
}

export class AdminCohortStatusUpdateDto {
  status!: AdminCohortStatus;
}
