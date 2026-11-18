# Mission 4.8B — Reviewed Preview checkpoint

2026-11-18. Branch `feature/website-v2`; parent `165f29a33574b5c02f0b6f34ad5ed0d89879ab07`.

## Explicit inclusion of the six earlier changes

The user authorized inclusion in Mission 4.8B. Each file matches the SHA-256 recorded before Mission 4.8:

- `app/components/marketing/city-events.tsx`: completed-result counter removed; loading announcements retained.
- `app/marketing.css`: square covers with centered `object-fit: cover`, responsive proportions checked.
- `lib/marketing-events.ts`: one bounded selected-city query, at most 60 candidates, existing eligibility/city filters first, then normalized-name deduplication and at most 12 emitted cards.
- `lib/marketing-events.test.ts`: deduplication/eligibility regression and explicit bound.
- `lib/marketing-cities.test.ts`: four minimal 12-row probes and one 60-row candidate query.
- `scripts/seo-http-smoke.mjs`: enforces five-request homepage budget and separate 12/60 row bounds.

The 12-to-60 candidate expansion is intentional and reviewed; no pagination, additional query or unbounded scan was introduced. The browser receives at most 12 safe card DTOs. City, country, moderation, creator, recurrence and time checks remain. No persistent media caching was introduced. Near-identical but differently spelled titles can remain; a pool with fewer than 12 distinct eligible names yields fewer cards.

## Mission 4.8 integration

Five-language metadata/content; download-only MobileApplication entities; organizer-versus-platform safeguards; Meetup heading hierarchy; relevant regression tests and review documents. Legal source files match the parent commit byte-for-byte. Description-language attribution remains blocked on a reliable public source-language contract; no guessed lang values.

## Fresh verification before commit/push

- Unit/security suite: 138 passed, zero failures.
- HTTP regression suite: 3,012 assertions, zero failures (including sitemap/media withdrawal/eligibility and noindex safeguards).
- ESLint, production build and TypeScript: passed.
- SEO/GEO route check: 25 routes, exact metadata, canonical/noindex, download-only app schema, Event attribution and claim behavior passed.
- City/carousel browser suite: mouse drag, click suppression, ordinary click, keyboard, touch, reduced motion, switching/races/empty/error, five languages passed.
- Additional real-data local check: four cities, at most 12 distinct names each, hidden counter and square cover crop at 390/1280px passed.
- Legal browser suite: all nine documents, exact text, links, trailing slash, responsive layout and explicit email fallback passed.

## Deployment safety

Read-only checks confirm GitHub default branch and Vercel Production branch `main`, no Vercel deploy hooks/custom environments and no production domain attached to the feature branch. Existing Production deployment: `dpl_EG2oZLX6a9tgccDJ3eMboU8bfJqF`. Push only the new checkpoint SHA to `refs/heads/feature/website-v2`; no main push/merge or direct production deploy.

Exact included paths: `FILES.txt`. All other untracked audits, SQL recovery experiments, local caches, environment files and temporary outputs remain excluded and preserved. A credential-pattern scan and staged allowlist equality check are required immediately before commit. `.vercelignore` already excludes docs, environment files and local dependencies from uploads; no change to it.

Final deployment identity and live verification belong in the local Mission 4.8B delivery report after the Git push. No DNS, Supabase, Flutter or production environment changes are authorized.
