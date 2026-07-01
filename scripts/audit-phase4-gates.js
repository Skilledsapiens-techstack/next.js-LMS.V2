const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

const gateNames = [
  'RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED',
  'RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED',
  'ENROLLMENT_ACTIVATION_ENABLED',
  'COHORT_WRITES_ENABLED',
  'STUDENT_WRITES_ENABLED',
  'PROJECT_SUBMISSION_WRITES_ENABLED',
  'PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED',
  'SUPPORT_TICKET_CREATION_WRITES_ENABLED',
  'SUPPORT_TICKET_REPLY_WRITES_ENABLED',
  'SUPPORT_TICKET_STATUS_WRITES_ENABLED',
  'WORKSHOP_STATUS_WRITES_ENABLED',
  'WORKSHOP_MEETING_PROVIDER_ENABLED',
  'WORKSHOP_MEETING_SCHEDULE_WRITES_ENABLED',
  'RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED',
  'RECORDING_PUBLICATION_WRITES_ENABLED',
  'EMAIL_OUTBOX_WRITES_ENABLED',
  'EMAIL_DISPATCH_WRITES_ENABLED',
  'EMAIL_DELIVERY_RESULT_WRITES_ENABLED',
  'EMAIL_PROVIDER_SENDS_ENABLED',
  'CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED',
  'CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED',
  'CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED',
  'CERTIFICATE_PDF_STORAGE_WRITES_ENABLED',
  'BACKGROUND_CLEANUP_WRITES_ENABLED'
];

const filesToCheck = [
  'workflows/domain/config/configuration.ts',
  '.env.example',
  'docs/PHASE_4_LOCAL_FOUNDATION_CHECKPOINT.md',
  'docs/PHASE_4_SUPABASE_WRITE_READINESS.md'
];

const configPath = 'workflows/domain/config/configuration.ts';

const failures = [];

for (const file of filesToCheck) {
  const absolutePath = path.join(rootDir, file);
  const content = fs.readFileSync(absolutePath, 'utf8');

  for (const gateName of gateNames) {
    if (!content.includes(gateName)) {
      failures.push(`${file} is missing ${gateName}`);
    }
  }
}

const envExample = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');

for (const gateName of gateNames) {
  const expectedLine = `${gateName}=false`;

  if (!envExample.includes(expectedLine)) {
    failures.push(`.env.example must keep ${expectedLine}`);
  }
}

const config = fs.readFileSync(path.join(rootDir, configPath), 'utf8');

for (const gateName of gateNames) {
  const gateIndex = config.indexOf(gateName);
  const defaultIndex = config.indexOf(".default('false')", gateIndex);
  const nextGateIndex = gateNames
    .map((name) => config.indexOf(name, gateIndex + gateName.length))
    .filter((index) => index !== -1)
    .sort((a, b) => a - b)[0];

  if (gateIndex === -1 || defaultIndex === -1 || (nextGateIndex !== undefined && defaultIndex > nextGateIndex)) {
    failures.push(`${configPath} must default ${gateName} to false`);
  }
}

if (failures.length > 0) {
  console.error('Phase 4 gate audit failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`ok phase4 gates: ${gateNames.length} gates documented and disabled by default`);
