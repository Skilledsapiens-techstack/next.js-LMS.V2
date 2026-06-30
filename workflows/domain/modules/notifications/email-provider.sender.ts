import { ConfigService } from "@app/common/runtime/config";
import { EmailDispatchPlan } from './email-dispatch-plan';

export type EmailProviderSendPayload = NonNullable<EmailDispatchPlan['dispatchPayload']>;

export type EmailProviderSendResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'sent' | 'failed';
  message: string;
  providerMessageId?: string;
  deliveredAt?: string;
  errorMessage?: string;
};
export class EmailProviderSender {
  constructor(private readonly config: ConfigService) {}

  async send(payload: EmailProviderSendPayload | undefined): Promise<EmailProviderSendResult> {
    if (!this.config.get<boolean>('EMAIL_PROVIDER_SENDS_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        message: 'Email provider sends are disabled. No provider call was attempted.'
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
      message: 'Email provider sends are enabled, but no email provider adapter is configured.',
      errorMessage: 'email_provider_adapter_missing'
   };
 }

  private validatePayload(payload: EmailProviderSendPayload | undefined): string | undefined {
    if (!payload) {
      return 'Email provider send skipped: missing dispatch payload.';
   }

    if (!this.cleanText(payload.to)) {
      return 'Email provider send skipped: missing recipient.';
   }

    if (!this.cleanText(payload.subject)) {
      return 'Email provider send skipped: missing subject.';
   }

    if (!this.cleanText(payload.html)) {
      return 'Email provider send skipped: missing HTML body.';
   }

    return undefined;
 }

  private cleanText(value: string | undefined): string | undefined {
    const text = value?.trim();
    return text || undefined;
 }
}
