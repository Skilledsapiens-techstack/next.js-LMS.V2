import { ForbiddenException, NotFoundException, ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { JsonObject, JsonValue } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { AdminDashboardDto, AdminProfileDto, AdminRole } from './dto/admin-dashboard.dto';

type AdminRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string | null;
  role: AdminRole;
  status: 'active' | 'inactive';
};
export class AdminsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getCurrentAdmin(user: User): Promise<AdminProfileDto> {
    const admin = await this.findActiveAdminForUser(user);
    return this.toAdminProfile(admin);
 }

  async getDashboard(admin: AdminProfileDto, accessToken: string): Promise<AdminDashboardDto> {
    const [{ data, error }, publishedRecordingCount] = await Promise.all([
      this.supabase.forUser(accessToken).rpc('lms_admin_dashboard_summary'),
      this.countPublishedRecordings()
    ]);

    if (error) {
      throw new ServiceUnavailableException(`Unable to load admin dashboard summary: ${error.message}`);
   }

    return {
      admin,
      summary: this.withPublishedRecordingCount(this.asJsonObject(data), publishedRecordingCount)
   };
 }

  private async countPublishedRecordings(): Promise<number> {
    const { count, error } = await this.supabase.admin
      .from('workshops')
      .select('id', { count: 'exact', head: true })
      .eq('workshop_status', 'Completed')
      .or('youtube_video_url.not.is.null,zoom_recording_url.not.is.null');

    if (error) {
      throw new ServiceUnavailableException(`Unable to load published recording count: ${error.message}`);
   }

    return count ?? 0;
 }

  private async findActiveAdminForUser(user: User): Promise<AdminRow> {
    const authUserId = user.id;
    const authEmail = this.normalizeEmail(user.email);

    if (!authEmail) {
      throw new ForbiddenException('Supabase user email is required for admin access.');
   }

    const { data, error } = await this.supabase.admin
      .from('admin_users')
      .select('id,auth_user_id,email,full_name,role,status')
      .or(`auth_user_id.eq.${authUserId},email.eq.${authEmail}`)
      .limit(2);

    if (error) {
      throw new ServiceUnavailableException(`Unable to load admin profile: ${error.message}`);
   }

    const rows = this.asAdminRows(data);
    const admin =
      rows.find((row) => row.auth_user_id === authUserId && this.normalizeEmail(row.email) === authEmail) ??
      rows.find((row) => row.auth_user_id === authUserId) ??
      rows.find((row) => this.normalizeEmail(row.email) === authEmail);

    if (!admin) {
      throw new NotFoundException('No admin profile is linked to this Supabase user.');
   }

    if (admin.status !== 'active') {
      throw new ForbiddenException('Admin profile is inactive.');
   }

    return admin;
 }

  private toAdminProfile(row: AdminRow): AdminProfileDto {
    return {
      id: row.id,
      email: this.normalizeEmail(row.email),
      fullName: row.full_name ?? undefined,
      role: row.role,
      status: 'active'
   };
 }

  private normalizeEmail(email: string | undefined | null): string {
    return String(email ?? '')
      .trim()
      .toLowerCase();
 }

  private asAdminRows(value: unknown): AdminRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.email === 'string' &&
        this.isAdminRole(row.role) &&
        (row.status === 'active' || row.status === 'inactive')
      );
   });
 }

  private isAdminRole(value: unknown): value is AdminRole {
    return value === 'owner' || value === 'admin' || value === 'operations' || value === 'mentor' || value === 'viewer';
 }

  private asJsonObject(value: JsonValue | unknown): JsonObject {
    return this.isJsonObject(value) ? value : {};
 }

  private withPublishedRecordingCount(summary: JsonObject, publishedRecordingCount: number): JsonObject {
    const existingRecordings = this.isJsonObject(summary.recordings) ? summary.recordings : {};

    return {
      ...summary,
      publishedRecordings: {
        total: publishedRecordingCount
     },
      recordings: {
        ...existingRecordings,
        published: publishedRecordingCount,
        total: publishedRecordingCount
     }
   };
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
