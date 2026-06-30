import { JsonObject } from '../../../common/types/json.types';

export type AdminRole = 'owner' | 'admin' | 'operations' | 'mentor' | 'viewer';

export class AdminProfileDto {
  id!: string;
  email!: string;
  fullName?: string;
  role!: AdminRole;
  status!: 'active';
}

export class AdminDashboardDto {
  admin!: AdminProfileDto;
  summary!: JsonObject;
}
