import { JsonObject } from '../../../common/types/json.types';

export class StudentProfileDto {
  id!: string;
  studentId?: string;
  fullName!: string;
  email!: string;
  collegeName?: string;
  cohortName?: string;
  programName?: string;
  trackRoleIds!: string[];
  active!: boolean;
}

export class StudentDashboardDto {
  student!: StudentProfileDto;
  dashboard!: JsonObject;
  resources!: JsonObject;
  projects!: JsonObject;
  certificates!: JsonObject;
}
