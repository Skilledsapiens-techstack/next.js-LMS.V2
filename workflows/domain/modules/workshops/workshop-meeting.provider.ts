import { ConfigService } from "@app/common/runtime/config";

export type WorkshopMeetingProviderPayload = {
  title: string;
  startsAt: string;
  durationMinutes: number;
  timezone?: string;
  hostEmail?: string;
  agenda?: string;
};

export type WorkshopMeetingProviderResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'created' | 'failed';
  message: string;
  providerMeetingId?: string;
  joinUrl?: string;
  startUrl?: string;
  errorMessage?: string;
};
export class WorkshopMeetingProvider {
  constructor(private readonly config: ConfigService) {}

  async createMeeting(payload: WorkshopMeetingProviderPayload | undefined): Promise<WorkshopMeetingProviderResult> {
    if (!this.config.get<boolean>('WORKSHOP_MEETING_PROVIDER_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        message: 'Workshop meeting provider is disabled. No provider call was attempted.'
     };
   }

    const validationError = this.validatePayload(payload);

    if (validationError) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        message: validationError
     };
   }

    return {
      enabled: true,
      attempted: false,
      status: 'failed',
      message: 'Workshop meeting provider is enabled, but no meeting provider adapter is configured.',
      errorMessage: 'workshop_meeting_provider_adapter_missing'
   };
 }

  private validatePayload(payload: WorkshopMeetingProviderPayload | undefined): string | undefined {
    if (!payload) {
      return 'Workshop meeting creation skipped: missing meeting payload.';
   }

    if (!this.cleanText(payload.title)) {
      return 'Workshop meeting creation skipped: missing title.';
   }

    if (!this.parseDate(payload.startsAt)) {
      return 'Workshop meeting creation skipped: invalid start time.';
   }

    if (!Number.isInteger(payload.durationMinutes) || payload.durationMinutes < 15 || payload.durationMinutes > 480) {
      return 'Workshop meeting creation skipped: invalid duration.';
   }

    return undefined;
 }

  private cleanText(value: string | undefined): string | undefined {
    const text = value?.trim();
    return text || undefined;
 }

  private parseDate(value: string): Date | undefined {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
 }
}
