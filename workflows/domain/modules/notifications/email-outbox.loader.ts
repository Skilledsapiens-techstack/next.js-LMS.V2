import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createEmailOutboxPlan,
  EmailBusinessEntity,
  EmailOutboxPlan,
  EmailRecipient,
  EmailTemplate
 } from './email-outbox-plan';

type EmailTemplateRow = {
  key: string;
  subject: string;
  html_body: string;
  text_body: string | null;
};

export type EmailOutboxLoadInput = {
  templateKey: string;
  recipient: EmailRecipient;
  variables?: Record<string, string | number | boolean | null | undefined>;
  entity: EmailBusinessEntity;
  requestedBy: string;
  priority?: 'normal' | 'high';
  requestedAt?: string;
  correlationId?: string;
};

export type EmailOutboxLoadResult = {
  status: 'ready' | 'not_found';
  plan?: EmailOutboxPlan;
  message: string;
};
export class EmailOutboxLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: EmailOutboxLoadInput): Promise<EmailOutboxLoadResult> {
    const templateKey = this.cleanText(input.templateKey);

    if (!templateKey) {
      return {
        status: 'not_found',
        message: 'Template key is required to load an email outbox plan.'
     };
   }

    const template = await this.loadTemplate(templateKey);

    if (!template) {
      return {
        status: 'not_found',
        message: 'No active email template matched the outbox source identity.'
     };
   }

    return {
      status: 'ready',
      plan: createEmailOutboxPlan({
        template: this.toEmailTemplate(template),
        recipient: input.recipient,
        variables: input.variables,
        entity: input.entity,
        requestedBy: input.requestedBy,
        priority: input.priority,
        requestedAt: input.requestedAt,
        correlationId: input.correlationId
     }),
      message: 'Email outbox plan loaded.'
   };
 }

  private async loadTemplate(templateKey: string): Promise<EmailTemplateRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('email_templates')
      .select(['key', 'subject', 'html_body', 'text_body', 'active'].join(','))
      .eq('key', templateKey)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load email template for outbox planning: ${error.message}`);
   }

    return this.asEmailTemplateRow(data);
 }

  private toEmailTemplate(row: EmailTemplateRow): EmailTemplate {
    return {
      key: row.key,
      subject: row.subject,
      htmlBody: row.html_body,
      textBody: row.text_body ?? undefined
   };
 }

  private asEmailTemplateRow(value: unknown): EmailTemplateRow | undefined {
    if (
      !this.isJsonObject(value) ||
      typeof value.key !== 'string' ||
      typeof value.subject !== 'string' ||
      typeof value.html_body !== 'string'
    ) {
      return undefined;
   }

    return {
      key: value.key,
      subject: value.subject,
      html_body: value.html_body,
      text_body: typeof value.text_body === 'string' ? value.text_body : null
   };
 }

  private cleanText(value: string): string {
    return value.trim();
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
