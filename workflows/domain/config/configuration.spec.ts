import { validateEnvironment } from './configuration';

const baseEnvironment = {
  NODE_ENV: 'production',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
};

describe('configuration', () => {
  it('requires Supabase project credentials', () => {
    expect(validateEnvironment(baseEnvironment)).toMatchObject({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
    });
  });

  it('keeps Razorpay webhook secret optional at boot so non-webhook environments can start', () => {
    expect(validateEnvironment(baseEnvironment).RAZORPAY_WEBHOOK_SECRET).toBe('');
  });

  it('keeps Razorpay webhook persistence disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED: 'true' }).RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED).toBe(true);
  });

  it('keeps Razorpay payment order transitions disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED: 'true' }).RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED).toBe(true);
  });

  it('keeps enrollment activation disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).ENROLLMENT_ACTIVATION_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, ENROLLMENT_ACTIVATION_ENABLED: 'true' }).ENROLLMENT_ACTIVATION_ENABLED).toBe(true);
  });

  it('keeps cohort writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).COHORT_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, COHORT_WRITES_ENABLED: 'true' }).COHORT_WRITES_ENABLED).toBe(true);
  });

  it('keeps student writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).STUDENT_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, STUDENT_WRITES_ENABLED: 'true' }).STUDENT_WRITES_ENABLED).toBe(true);
  });

  it('keeps project submission writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).PROJECT_SUBMISSION_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, PROJECT_SUBMISSION_WRITES_ENABLED: 'true' }).PROJECT_SUBMISSION_WRITES_ENABLED).toBe(true);
  });

  it('keeps project submission review writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED: 'true' }).PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED).toBe(true);
  });

  it('keeps support ticket creation writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).SUPPORT_TICKET_CREATION_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, SUPPORT_TICKET_CREATION_WRITES_ENABLED: 'true' }).SUPPORT_TICKET_CREATION_WRITES_ENABLED).toBe(true);
  });

  it('keeps support ticket reply writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).SUPPORT_TICKET_REPLY_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, SUPPORT_TICKET_REPLY_WRITES_ENABLED: 'true' }).SUPPORT_TICKET_REPLY_WRITES_ENABLED).toBe(true);
  });

  it('keeps support ticket status writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).SUPPORT_TICKET_STATUS_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, SUPPORT_TICKET_STATUS_WRITES_ENABLED: 'true' }).SUPPORT_TICKET_STATUS_WRITES_ENABLED).toBe(true);
  });

  it('keeps workshop status writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).WORKSHOP_STATUS_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, WORKSHOP_STATUS_WRITES_ENABLED: 'true' }).WORKSHOP_STATUS_WRITES_ENABLED).toBe(true);
  });

  it('keeps recording candidate review writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED: 'true' }).RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED).toBe(true);
  });

  it('keeps recording publication writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).RECORDING_PUBLICATION_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, RECORDING_PUBLICATION_WRITES_ENABLED: 'true' }).RECORDING_PUBLICATION_WRITES_ENABLED).toBe(true);
  });

  it('keeps email outbox writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).EMAIL_OUTBOX_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, EMAIL_OUTBOX_WRITES_ENABLED: 'true' }).EMAIL_OUTBOX_WRITES_ENABLED).toBe(true);
  });

  it('keeps email dispatch writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).EMAIL_DISPATCH_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, EMAIL_DISPATCH_WRITES_ENABLED: 'true' }).EMAIL_DISPATCH_WRITES_ENABLED).toBe(true);
  });

  it('keeps email delivery result writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).EMAIL_DELIVERY_RESULT_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, EMAIL_DELIVERY_RESULT_WRITES_ENABLED: 'true' }).EMAIL_DELIVERY_RESULT_WRITES_ENABLED).toBe(true);
  });

  it('keeps certificate request approval writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED: 'true' }).CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED).toBe(true);
  });

  it('keeps certificate generation finalization writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED: 'true' }).CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED).toBe(true);
  });

  it('keeps certificate PDF render-start writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED: 'true' }).CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED).toBe(true);
  });

  it('keeps certificate PDF storage writes disabled unless explicitly enabled', () => {
    expect(validateEnvironment(baseEnvironment).CERTIFICATE_PDF_STORAGE_WRITES_ENABLED).toBe(false);
    expect(validateEnvironment({ ...baseEnvironment, CERTIFICATE_PDF_STORAGE_WRITES_ENABLED: 'true' }).CERTIFICATE_PDF_STORAGE_WRITES_ENABLED).toBe(true);
  });
});
