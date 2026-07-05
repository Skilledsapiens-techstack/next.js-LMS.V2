# Razorpay CEP / Live Projects Google Sheet Import

Google Apps Script webhook handler for the other company's Razorpay forms:

- CEP - Corporate Excellence Programs
- Live Projects

## Google Sheet

Target sheet:

```text
https://docs.google.com/spreadsheets/d/1wAXRxlQ8nHHwwnyuyqZE9txrKM443Gfqll80_bQOTKs/edit
```

## Tabs Created

- `Raw Razorpay Payments`
- `CEP - Import Ready`
- `Live Projects - Import Ready`
- `Mapping / Config`
- `Errors / Needs Review`

## Import-Ready Columns

```text
fullName
email
altEmail
phone
collegeName
programNames
personalmentor
you_are_from
project_start_date
duration
payment_date
payment_page_title
```

## Behavior

- Processes only `payment.captured`.
- Ignores failed/refunded/non-captured payments.
- Ignores duplicate `payment_id`.
- Sends CEP payments to `CEP - Import Ready`.
- Sends Live Project payments to `Live Projects - Import Ready`.
- Keeps complete audit/payload data in `Raw Razorpay Payments`.
- Sends missing/unknown records to `Errors / Needs Review`.
- Joins multiple selected roles in `programNames` using `|`.
- Uses direct Razorpay role names; no LMS mapping is applied.

## Apps Script Setup

1. Open the Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Replace the default `Code.gs` content with this folder's `Code.gs`.
4. Save the project.
5. Run `setupWorkbook()` once.
6. Deploy:

```text
Deploy -> New deployment -> Web app
Execute as: Me
Who has access: Anyone
```

7. Copy the Web App URL and append the private token:

```text
https://script.google.com/macros/s/.../exec?token=425cffda5943428bc80edbd9ba4956662a36b74ac0b433895a5fe85a11d900ef
```

8. Add that full URL in Razorpay webhook settings.

Webhook event:

```text
payment.captured
```

Secret:

```text
Leave blank
```

## Security Note

Google Apps Script web apps do not reliably expose Razorpay's `X-Razorpay-Signature`
header to `doPost(e)`, so this implementation uses a private URL token plus duplicate
`payment_id` protection.

For stricter production security, place a small proxy in front of Apps Script:

- Cloudflare Worker
- Google Cloud Function
- Supabase Edge Function

That proxy should verify Razorpay's HMAC signature, then forward only verified payloads
to this Apps Script URL using the private token.
