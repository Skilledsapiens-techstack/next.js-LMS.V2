# Google Slides Certificate Generator

This LMS can generate certificates from Google Slides templates instead of drawing text onto PDF coordinates.

## Why This Exists

The old PDF overlay model uses `pdf-lib` and hard-coded coordinates. It is fragile when certificate text length changes or when the template already contains visible placeholders. The Google Slides model keeps the visual design in Google Slides and replaces editable placeholders before exporting the slide as a PDF.

## Template Links

- Leadership Certificate: `1WUabyBlCquIniL2r0rsR7p8Bl5Bd6KoZ5pUkHt3dy5U`
- Live Project Certificate: `1wvuH3x9JBxCUgtz339cXamlmiUAvnPSc_djfsMA4E3A`

## Current Apps Script Project

- Script project: `https://script.google.com/d/1K7hCVoDfKVKRL5NbDXzLv4YhNZHfeoK2fm9dyZVMje7TqC4NRuC2GbMw/edit`
- Latest deployment attempted: `https://script.google.com/macros/s/AKfycbzxkzUdGzdxzAVAtBl8CphoxEih_VLNrHj-aMHX4Zk7P9zAOvnJyFcq_qMDnqQ21IZ49Q/exec`
- Important: the `/exec` URL must return JSON for POST requests. If it returns a Google HTML/login page, open Apps Script Deploy > Manage deployments and ensure the Web App is deployed with:
  - Execute as: Me
  - Who has access: Anyone with the link

The Supabase `CERTIFICATE_SLIDES_WEBAPP_URL` and `CERTIFICATE_SLIDES_SECRET` secrets should only be enabled after the `/exec` URL is publicly callable by the Supabase Edge Function. If Google Slides rejects the request at runtime, the Edge Function records the Slides error and falls back to the older PDF-template generator so issuance does not get blocked.

## Supported Placeholders

Use editable text boxes in the Google Slides templates.

- `{{student_name}}`
- `{{student_email}}`
- `{{program_name}}`
- `{{program}}`
- `{{program_key}}`
- `{{cohort_name}}`
- `{{cohort}}`
- `{{project_title}}`
- `{{project_role}}`
- `{{role_name}}`
- `{{project_start_date}}`
- `{{project_end_date}}`
- `{{project_date_range}}`
- `{{duration_label}}`
- `{{modules_covered}}`
- `{{modules}}`
- `{{module_list}}`
- `{{certificate_id}}`
- `{{issue_date}}`
- `{{verification_url}}`
- `{{portal_url}}`
- `{{qr_code}}`

For QR code, place a text box where the QR should appear and put only `{{qr_code}}` inside it. The script replaces that box with a QR image for the certificate verification URL.

## Deployment Steps

1. Create a Google Apps Script project from the Google account that owns or can edit both template decks.
2. Copy `scripts/google-slides-certificate-generator/Code.gs` into the Apps Script project.
3. Copy `scripts/google-slides-certificate-generator/appsscript.json` into the Apps Script manifest.
4. In Apps Script, open Project Settings and add script properties:
   - `CERTIFICATE_SLIDES_SECRET`: a long random secret.
   - Optional override: `LEADERSHIP_TEMPLATE_ID`
   - Optional override: `LIVE_PROJECT_TEMPLATE_ID`
5. Deploy as Web App:
   - Execute as: Me
   - Who has access: Anyone with the link
   - If using a Google Workspace account, confirm the workspace allows public Apps Script Web Apps.
6. Run one authorization from the Apps Script editor:
   - Open `Code.gs`.
   - Select `authorizeCertificateSlidesGenerator`.
   - Click Run.
   - Accept the Google permission prompts for Slides and Drive.
   - The deployed web app cannot call `SlidesApp.openById` until this one-time authorization is completed.
7. Add Supabase Edge Function secrets:
   - `CERTIFICATE_SLIDES_WEBAPP_URL`: the deployed Apps Script Web App URL.
   - `CERTIFICATE_SLIDES_SECRET`: the same secret from Apps Script.
8. Deploy the Supabase `certificate-issuance` function.

## Runtime Behavior

- Supabase remains the source of truth for certificate metadata.
- Google Slides is the source of truth for certificate design.
- Generated Google Slide copies are trashed immediately after PDF export.
- Generated PDFs are stored in `temporary-certificates` for 24 hours.
- The existing email attachment and signed download URL flow remains unchanged.
- If the Slides Web App URL is not configured, or if Google rejects the Slides request, the Edge Function falls back to the old PDF-template generator instead of blocking issuance.
