# Mission 4.5A — Reviewed Website V2 Preview checkpoint

Prepared on 18 November 2026, local branch **feature/website-v2**. No push, deployment, DNS change, production environment modification, database write, RLS/Flutter change or real recovery/OAuth/email operation.

## Git baseline and inventory

Parent production baseline: **212e8cb23960587519c5367b8a1330a85550706a**, `chore: establish Evy SEO production baseline`. Its source manifest reconciles the November 7 deployment `dpl_7zeHSV3B4wvzB4kWtNhERzgXdikF`.

Fresh read-only Git remote inspection: GitHub main remains `e00bc46d6419586226e85ad1b2de40ff4d4e71c9`; remote `feature/website-v2` did not exist at inspection. The local checkpoint includes the production baseline ancestry; it is not a reconstruction from the outdated remote main.

The new commit message is **chore: checkpoint Evy Website V2 preview candidate**. Its exact hash is reported in the final handoff and can be retrieved with `git rev-parse feature/website-v2`. A document cannot embed the hash of its own containing commit without changing that hash.

`checkpoint-files.txt` lists every tracked file in the complete candidate, including unchanged baseline files. `checkpoint-changes.txt` lists the changes relative to the production baseline.

Included application changes:

- Mission 3 marketing pages, five dictionaries/languages, shared layout/components, carousel, official branding and required screenshots/assets.
- Revision-zero managed-media validation and regression tests; all other media policy retained.
- Nine legal/support/contact pages, faithful published English snapshots, language fallback, trailing-slash compatibility, email-only contact state and deferred Resend preparation.
- AASA/assetlinks documents, fixed Flutter web deep-link compatibility, independent sitemaps, preview/launch indexing gate, verification scripts/tests.
- Existing dependency lockfile, configuration, fonts/licenses, Event SEO source and security tests.

The baseline Event detail page/JSON-LD and its November 7 claim CTA were not overwritten. Media acceptance changed only from positive integer revisions to non-negative integers.

## Deliberate exclusions

All existing excluded work remains on disk. Nothing was discarded.

- `.env*`, `.vercel`, secrets/credentials, dependencies, `.next`, caches, temporary checkouts, raw verification logs and exported provider environment values.
- Experimental geographic SQL/recovery packages and their audit exports in `docs/website-v2-mission4-1a`, `4-1c`, `4-1d`. No `.sql` file is tracked in this candidate.
- Older untracked audit/export directories and unnecessary route/browser test-output JSON files. The published legal-content evidence required by the browser regression test is retained.

Geolocation remains inactive; see `DEFERRED-GEOLOCATION.md`. The current carousel is the existing bounded upcoming public-event selection, not a claim that Lausanne/Geneva balancing or nearby search is implemented.

The existing `.vercelignore` excludes `.env*`, `.git`, `node_modules`, and `docs` for CLI packaging. The approved future path is deployment from the reviewed Git commit, not an indiscriminate upload of this working directory. SQL is excluded from Git independently of upload-ignore behavior.

## Preview safety

Default/Preview marketing and legal metadata remain noindex. Proxy adds HTTP noindex for non-approved environments or non-production effective hostnames. Preview robots disallows `/`; the page sitemap contains zero page entries. The root retains 256 canonical public event partitions plus the page-sitemap leaf. Canonicals and language alternates always name `https://myevy.app`, never the Preview hostname.

The launch gate requires NODE_ENV=production, VERCEL_ENV=production, EVY_PUBLIC_INDEXING=enabled and EVY_SITE_ORIGIN=https://myevy.app together. Preview vetoes indexing even if launch flags are copied. Leave EVY_PUBLIC_INDEXING unset/disabled for Preview; never override Vercel's Preview identity.

All event reads retain anonymous access and public/moderation/creator/recurrence checks. Image endpoints recheck authorization/withdrawal and retain private/no-store. No mutation endpoint, privileged backend client, geographic job, schema operation or RLS change was added. Supabase rejects invalid backend access independently; the application's credential guard rejects service-role/user JWTs and secret-key formats before creating the client.

The local verification key passed the existing anon/publishable guard. Fresh Vercel inventory shows only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` assigned to Preview, both marked sensitive; no service-role variable is listed. Vercel's export returned empty values for those sensitive fields, so their actual stored content **could not be independently verified**. Do not interpret the redacted/empty export as proof that the configured deployment values are empty, nor claim their actual roles were validated. The application will fail closed if supplied an invalid/privileged key. The temporary export, including platform-generated credentials, was deleted without printing its values.

`MAPTILER_API_KEY` is currently scoped only to production. Preview maps will not have full current-production functionality until an approved Preview-scoped key/configuration is provided. No such setting was modified here.

## Fresh Vercel Git policy inspection

Project **evy-seo**, team **evy7 / Evy**, project ID `prj_kJoQTcE00qVNLI2UGKDuPue0tqzK`, Node **24.x**. Linked repository **AlexScoppEshap/evy_seo**. Production branch **main**; automatic Git deployments enabled; no custom environments or deploy hooks reported. Default build command/root configuration; no ignored-build command reported.

Under the observed settings, pushing **feature/website-v2** is expected to trigger **Preview only**, subject to integration/platform checks. Pushing or merging into **main** would trigger production. No candidate GitHub workflow or deployment hook introduces an additional production action. Reinspect settings immediately before a future authorized push because external configuration can change.

The initial direct API access attempt returned 403; authenticated Vercel CLI read-only inspection succeeded and supplied the recorded evidence. No configuration update was made.

## Verification of the reviewed source

An isolated clean checkout was produced from the reviewed Git index, without `.env.local`, prior `.next` output or working-tree-only files. Dependencies were installed from the unchanged lockfile. Node **24.22.3**, matching Vercel's configured major version, was used.

| Verification | Result |
|---|---|
| `npm ci --no-audit --no-fund` | Passed, 370 packages |
| `npm test` | 130 passed, zero failures |
| `npm run lint` | Passed |
| `npm run build` | Passed with default Next 16.4.5 Turbopack; no special build-command requirement |
| `npm run typecheck` | Passed after generated build types |
| `npm run test:http` | 2,992 assertions, zero failures |
| `scripts/cutover-review.mjs` | PASS: associations, 8 synthetic deep-link cases, 257 root leaves, empty Preview page sitemap, 25 marketing metadata pages, nine legal pages |
| `scripts/website-route-review.mjs` | PASS: 25 routes, internal links/assets, 12/12 covers available, invalid routes rejected |
| `scripts/legal-pages-review.mjs` | PASS: nine source-text/link comparisons, slash/canonical/lang checks, responsive and keyboard checks |
| Source/secret review | No environment value/private-key matches; no forbidden tracked paths or experimental SQL |

Build/unit/HTTP validation used synthetic anonymous backend configuration and isolated fixtures. The HTTP suite verifies all 256 partitions, public eligibility failures, RSC authorization, media withdrawal, no-store behavior, local reverse proxy and local Apache/TLS compatibility. The fresh local route checks used the existing local anonymous Supabase configuration for read-only public-event requests; no hosted Preview was deployed or tested.

The full candidate is source-compatible with current Event SEO behavior under the regression fixtures. Hosted Preview maps and actual remote sensitive values remain external configuration limitations; installed-device verification and DNS cutover are not claimed.

Existing non-fatal warnings: module-type inference in TypeScript scripts and blocked optional `unrs-resolver` postinstall under npm's current policy. No dependency or install-script policy was changed to suppress them.

## Remaining gates

1. Explicit approval before any push/deployment. Current mission creates only a local commit.
2. Confirm actual Preview Supabase values are the intended public URL and anon/publishable key without exposing them; do not add service_role.
3. Approve and supply Preview-only MapTiler configuration if complete map functionality is required. Otherwise explicitly accept unavailable maps for the visual Preview.
4. Recheck Git production-branch policy before pushing; abort if feature/website-v2 could target production.
5. Device association/Android prefix ambiguity, legal hosting/privacy reviews, real contact delivery and log redaction remain separate production-cutover blockers from Mission 4.4.

See `PREVIEW-PLAN.md` for the exact future procedure. This checkpoint is suitable for code review and future Preview preparation, not an authorization to publish or switch DNS.
