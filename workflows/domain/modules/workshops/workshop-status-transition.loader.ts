import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createWorkshopStatusTransitionPlan,
  WorkshopForStatusTransition,
  WorkshopStatus,
  WorkshopStatusTransitionPlan
 } from './workshop-status-transition-plan';

type WorkshopStatusTransitionRow = {
  id: string;
  workshop_id: string | null;
  title: string;
  workshop_status: WorkshopStatus;
};

export type WorkshopStatusTransitionLoadInput = {
  workshopId: string;
  nextStatus: WorkshopStatus;
  adminEmail: string;
  changedAt?: string;
};

export type WorkshopStatusTransitionLoadResult = {
  status: 'ready' | 'not_found';
  plan?: WorkshopStatusTransitionPlan;
  message: string;
};
export class WorkshopStatusTransitionLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: WorkshopStatusTransitionLoadInput): Promise<WorkshopStatusTransitionLoadResult> {
    const workshopId = this.cleanText(input.workshopId);
    const adminEmail = this.normalizeEmail(input.adminEmail);

    if (!workshopId || !adminEmail) {
      return {
        status: 'not_found',
        message: 'Workshop ID and admin email are required to load a status transition plan.'
     };
   }

    const workshop = await this.loadWorkshop(workshopId);

    if (!workshop) {
      return {
        status: 'not_found',
        message: 'No workshop matched the status transition source identity.'
     };
   }

    return {
      status: 'ready',
      plan: createWorkshopStatusTransitionPlan(this.toWorkshopForStatusTransition(workshop), {
        adminEmail,
        nextStatus: input.nextStatus,
        changedAt: input.changedAt
     }),
      message: 'Workshop status transition plan loaded.'
   };
 }

  private async loadWorkshop(workshopId: string): Promise<WorkshopStatusTransitionRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('workshops')
      .select(['id', 'workshop_id', 'title', 'workshop_status'].join(','))
      .eq('id', workshopId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load workshop for status transition: ${error.message}`);
   }

    return this.asWorkshopStatusTransitionRow(data);
 }

  private toWorkshopForStatusTransition(row: WorkshopStatusTransitionRow): WorkshopForStatusTransition {
    return {
      id: row.id,
      workshopId: row.workshop_id ?? undefined,
      title: row.title,
      status: row.workshop_status
   };
 }

  private asWorkshopStatusTransitionRow(value: unknown): WorkshopStatusTransitionRow | undefined {
    if (
      !this.isJsonObject(value) ||
      typeof value.id !== 'string' ||
      typeof value.title !== 'string' ||
      !this.isWorkshopStatus(value.workshop_status)
    ) {
      return undefined;
   }

    return {
      id: value.id,
      workshop_id: typeof value.workshop_id === 'string' ? value.workshop_id : null,
      title: value.title,
      workshop_status: value.workshop_status
   };
 }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
 }

  private cleanText(value: string): string {
    return value.trim();
 }

  private isWorkshopStatus(value: unknown): value is WorkshopStatus {
    return value === 'Upcoming' || value === 'Scheduled' || value === 'Live' || value === 'Completed' || value === 'Cancelled' || value === 'Inactive';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
