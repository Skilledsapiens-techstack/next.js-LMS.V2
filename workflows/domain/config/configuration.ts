import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  ENROLLMENT_ACTIVATION_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  COHORT_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  STUDENT_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  PROJECT_SUBMISSION_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SUPPORT_TICKET_CREATION_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SUPPORT_TICKET_REPLY_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SUPPORT_TICKET_STATUS_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  WORKSHOP_STATUS_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  WORKSHOP_MEETING_PROVIDER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  WORKSHOP_MEETING_SCHEDULE_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  RECORDING_PUBLICATION_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  EMAIL_OUTBOX_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  EMAIL_DISPATCH_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  EMAIL_DELIVERY_RESULT_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  EMAIL_PROVIDER_SENDS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  CERTIFICATE_PDF_STORAGE_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  BACKGROUND_CLEANUP_WRITES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true')
});

type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>) {
  const parsed = environmentSchema.safeParse(config);

  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }

  return parsed.data;
}

export function configuration() {
  return validateEnvironment(process.env) as Environment;
}
