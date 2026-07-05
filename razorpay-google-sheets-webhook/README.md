# Razorpay Paid Students - LMS Import

Google Apps Script webhook handler for:

- Leadership Programs Razorpay form
- Corporate Live Projects Razorpay form
- Google Sheet import-ready tabs for LMS student import

## Google Sheet Tabs

- `Raw Razorpay Payments`
- `Leadership Programs - Import Ready`
- `Live Projects - Import Ready`
- `Mapping / Config`
- `Errors / Needs Review`

## Apps Script Setup

1. Open the Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Replace the default `Code.gs` content with `Code.gs` from this folder.
4. Save the project.
5. Run `setupWorkbook()` once.
6. Set script property:

```text
RAZORPAY_WEBHOOK_TOKEN = a-long-random-secret
```

In Apps Script:

```text
Project Settings -> Script Properties -> Add script property
```

7. Deploy:

```text
Deploy -> New deployment -> Web app
Execute as: Me
Who has access: Anyone
```

8. Copy the Web App URL and append the token:

```text
https://script.google.com/macros/s/.../exec?token=YOUR_LONG_RANDOM_SECRET
```

9. Add this URL in Razorpay webhook settings.

Webhook event:

```text
payment.captured
```

## Important Security Note

Google Apps Script web apps do not reliably expose Razorpay's `X-Razorpay-Signature`
request header to `doPost(e)`, so this implementation uses a secret URL token plus
duplicate `payment_id` protection.

For stricter production security, place a small server/proxy in front of this script:

- Cloudflare Worker
- Google Cloud Function
- Supabase Edge Function

That proxy should verify Razorpay's HMAC signature, then forward the verified payload
to this Apps Script URL using the private token.

## Behavior

- Processes only captured payments.
- Ignores duplicate `payment_id`.
- Sends Leadership payments to `Leadership Programs - Import Ready`.
- Sends Live Project payments to `Live Projects - Import Ready`.
- Stores raw payload/audit fields in `Raw Razorpay Payments`.
- Sends unmapped or incomplete records to `Errors / Needs Review`.
- Keeps LMS-generated fields blank as agreed.

## LMS Import Headers

```text
studentId
fullName
email
altEmail
phone
collegeName
cohortNames
programNames
waGroup
personalmentor
you_are_from
project_start_date
duration
onboardingMailStatus
active
```
