# Security Baseline

## Authentication

- Use Supabase Auth as the identity provider.
- Verify JWTs on the Nest.js server for protected APIs.
- Reject missing, malformed, expired, or invalid tokens.

## Authorization

- Enforce admin/student role checks server-side.
- Use least-privilege access for every domain.
- Keep RLS enabled for tables exposed to client-side Supabase access.

## Secrets

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Store secrets only in deployment secret managers.
- Redact authorization headers, cookies, and tokens from logs.

## Data Protection

- Validate all DTOs.
- Reject unknown fields.
- Use signed URLs for private certificates and submissions.
- Log security-sensitive actions to audit tables.

## Operational Security

- Rate limit public and authenticated endpoints.
- Keep API documentation disabled unless explicitly enabled for a controlled environment.
- Monitor auth failures and abnormal request volume.
- Keep dependencies patched.
- Run security checks before every production release.
