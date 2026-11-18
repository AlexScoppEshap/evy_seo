# Contact delivery preparation — not activated

Existing infrastructure inspected: Flutter repository `supabase/functions/transactional-email-dispatcher/index.ts`, plus signup/password-reset and claim email functions. They use Resend and server-side secrets. The dispatcher supports welcome, notification and event-claim messages; it is not a general public contact endpoint. Do not reuse a privileged dispatch secret in the browser or overload an event-claim payload.

The user authorized subsequent preparation of the Resend integration. No provider configuration, secret provisioning, database changes or real email sends have been performed. No contact submission endpoint has been installed. The visible email link is the current working contact method.

## Proposed next implementation

- Same-origin POST `/api/contact`, Node server only. No browser Resend SDK.
- Name (2–100 characters), email (max 254, validated), subject (3–150), message (20–5000). Reject control characters in header fields, extra recipient fields and oversized bodies (16 KiB maximum). Trim text, validate types on the server, escape HTML or use plain-text email.
- Fixed destination `info@myevy.app`; verified Evy sender configured server-side. Visitor email may be Reply-To only, never From. Do not accept arbitrary to/cc/bcc fields.
- Strict allowed Origin and content type; accessible labeled fields, field-level errors, error summary and status region. Preserve inputs on failure. Show success only after the provider accepts delivery; distinguish acceptance from delivery to the inbox.
- Honeypot, server-verified challenge, short-lived submission nonce/idempotency key. Honeypot alone is insufficient.
- Shared atomic rate limiting across Vercel instances (proposed initial limits: 3/minute and 10/hour per short-lived HMAC of a trusted platform client IP; global quota/circuit breaker). In-memory limits alone are not production-safe. Explicitly review proxy IP trust, TTLs and false positives.
- No message text, email addresses, raw IP addresses or credentials in logs/analytics. Short-lived non-reversible limiter keys; minimal provider delivery ID/status logs with a retention decision. Private/no-store responses; no open CORS.
- No automatic visitor confirmation email initially, to avoid an email-bombing surface. Provider timeout, bounded retries with idempotency and truthful 429/503 feedback.

## Configuration still requiring a concrete approved choice

1. Scoped Resend server credential in Next/Vercel and a verified existing sender. Do not copy secrets from Supabase without explicit provisioning authorization.
2. Shared limiter and anti-bot verification mechanism: evaluate existing hosting facilities before selecting another service or changing any schema. Neither is configured in this mission.
3. Contact-data retention/access and legal notice implications, including Resend processing and any additional anti-spam provider.
4. A separately approved real-email verification to `info@myevy.app`, after mock-only tests pass.

## Required tests before activation

Valid submission with mocked Resend; all invalid/missing/boundary inputs; CRLF and HTML injection; arbitrary recipient rejection; cross-origin requests; body limits; honeypot; invalid/expired/replayed challenge; concurrent distributed rate limit; Retry-After; repeated idempotency key; provider timeout/429/5xx; no false success; keyboard and screen reader validation; no payload/secrets in logs/client bundle. Testing must use a mock transport until real sends are explicitly approved.
