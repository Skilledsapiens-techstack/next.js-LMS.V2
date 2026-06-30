import { createHash } from 'crypto';

export type EmailTemplate = {
  key: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
};

export type EmailRecipient = {
  email: string;
  name?: string;
};

export type EmailBusinessEntity = {
  table: string;
  id: string;
  action: string;
};

export type EmailOutboxInput = {
  template: EmailTemplate;
  recipient: EmailRecipient;
  variables?: Record<string, string | number | boolean | null | undefined>;
  entity: EmailBusinessEntity;
  requestedBy: string;
  priority?: 'normal' | 'high';
  requestedAt?: string;
  correlationId?: string;
};

export type EmailOutboxPlan = {
  shouldEnqueue: boolean;
  reason:
    | 'ready'
    | 'missing_template_key'
    | 'missing_recipient_email'
    | 'missing_entity'
    | 'missing_requested_by'
    | 'missing_subject'
    | 'missing_body'
    | 'invalid_priority';
  idempotencyKey?: string;
  emailJobRow?: {
    idempotency_key: string;
    template_key: string;
    recipient_email: string;
    recipient_name?: string;
    subject: string;
    html_body: string;
    text_body?: string;
    status: 'pending';
    priority: 'normal' | 'high';
    entity_table: string;
    entity_id: string;
    entity_action: string;
    requested_by: string;
    requested_at: string;
    correlation_id?: string;
    attempt_count: 0;
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'email.enqueued';
    entity: 'email_outbox';
    entity_id: string;
    actor_id: string;
    next_state: {
      templateKey: string;
      recipientEmail: string;
      entityTable: string;
      entityId: string;
      entityAction: string;
      priority: 'normal' | 'high';
    };
  };
};

const allowedPriorities: Array<EmailOutboxInput['priority']> = ['normal', 'high'];

export function createEmailOutboxPlan(input: EmailOutboxInput): EmailOutboxPlan {
  const templateKey = cleanText(input.template.key);
  const recipientEmail = normalizeEmail(input.recipient.email);
  const entityTable = cleanText(input.entity.table);
  const entityId = cleanText(input.entity.id);
  const entityAction = cleanText(input.entity.action);
  const requestedBy = normalizeActor(input.requestedBy);
  const priority = input.priority ?? 'normal';
  const subjectTemplate = cleanText(input.template.subject);
  const htmlTemplate = cleanText(input.template.htmlBody);

  if (!templateKey) {
    return { shouldEnqueue: false, reason: 'missing_template_key' };
  }

  if (!recipientEmail) {
    return { shouldEnqueue: false, reason: 'missing_recipient_email' };
  }

  if (!entityTable || !entityId || !entityAction) {
    return { shouldEnqueue: false, reason: 'missing_entity' };
  }

  if (!requestedBy) {
    return { shouldEnqueue: false, reason: 'missing_requested_by' };
  }

  if (!subjectTemplate) {
    return { shouldEnqueue: false, reason: 'missing_subject' };
  }

  if (!htmlTemplate) {
    return { shouldEnqueue: false, reason: 'missing_body' };
  }

  if (!allowedPriorities.includes(priority)) {
    return { shouldEnqueue: false, reason: 'invalid_priority' };
  }

  const requestedAt = cleanText(input.requestedAt) ?? new Date().toISOString();
  const idempotencyKey = `email:${templateKey}:${recipientEmail}:${entityTable}:${entityId}:${entityAction}`;
  const rendered = renderTemplateParts(input.template, input.variables ?? {});

  return {
    shouldEnqueue: true,
    reason: 'ready',
    idempotencyKey,
    emailJobRow: {
      idempotency_key: idempotencyKey,
      template_key: templateKey,
      recipient_email: recipientEmail,
      recipient_name: cleanText(input.recipient.name),
      subject: rendered.subject,
      html_body: rendered.htmlBody,
      text_body: rendered.textBody,
      status: 'pending',
      priority,
      entity_table: entityTable,
      entity_id: entityId,
      entity_action: entityAction,
      requested_by: requestedBy,
      requested_at: requestedAt,
      correlation_id: cleanText(input.correlationId),
      attempt_count: 0
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}:email.enqueued`,
      action: 'email.enqueued',
      entity: 'email_outbox',
      entity_id: idempotencyKey,
      actor_id: requestedBy,
      next_state: {
        templateKey,
        recipientEmail,
        entityTable,
        entityId,
        entityAction,
        priority
      }
    }
  };
}

function renderTemplateParts(template: EmailTemplate, variables: Record<string, string | number | boolean | null | undefined>) {
  return {
    subject: renderTemplate(template.subject, variables),
    htmlBody: renderTemplate(template.htmlBody, variables),
    textBody: template.textBody ? renderTemplate(template.textBody, variables) : undefined
  };
}

function renderTemplate(template: string, variables: Record<string, string | number | boolean | null | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => escapeRenderedValue(variables[key]));
}

function escapeRenderedValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeEmail(value: string): string | undefined {
  const email = value.trim().toLowerCase();
  return email || undefined;
}

function normalizeActor(value: string): string | undefined {
  const actor = value.trim().toLowerCase();
  return actor || undefined;
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

export function emailOutboxPayloadHash(row: NonNullable<EmailOutboxPlan['emailJobRow']>): string {
  return createHash('sha256')
    .update([row.template_key, row.recipient_email, row.subject, row.html_body, row.text_body ?? '', row.entity_table, row.entity_id, row.entity_action].join('|'))
    .digest('hex');
}
