# Mission 4.6A — City selector and native carousel

Validated locally on 2026-11-18. Branch `feature/website-v2`; HEAD remains `97f86bf01d8b45cf94601f333c181d6b6db4618e`. No commit, push or deployment. Existing unrelated local files preserved.

## Implementation

Centralized launch configuration: Lausanne, Genève, Neuchâtel, Zürich, in that order. Stable country-qualified identities and explicit city aliases prevent cross-country collisions and duplicate pills. Labels and status messages support FR/EN/DE/IT/ES. This is not a global ranking.

SSR checks availability, hides empty cities and selects Lausanne when available, otherwise the first available configured city. The first selected city's cards are server rendered. City selection retrieves up to 12 cards, clears stale cards while loading, cancels obsolete requests and handles failures/empty results accessibly. A city that becomes empty on selection is removed; focus moves to the results panel.

Native horizontal scrolling, CSS snapping, touch and reduced-motion behavior remain. Desktop mouse dragging starts after a horizontal threshold, suppresses accidental navigation and snaps after release. Normal clicks, Tab, ArrowLeft/Right, Home/End and arrow controls work. No autoplay or scrolling-triggered fetches.

## Query strategy and security

Four fixed parallel availability probes, each selecting only minimal location/eligibility fields with a 12-row limit and five-second timeout. One additional query loads up to 12 complete cards for the selected city. Maximum initial application budget: five database requests, 48 minimal candidate rows plus 12 selected records. A city switch uses one bounded card query. This is a fixed per-city fanout, not per-card N+1 enrichment. Other cities' full cards/media are not preloaded.

SQL filters retain public visibility, moderation approval, active creator, standard event, active/null recurrence, scheduled/postponed status, upcoming start, non-expired end and non-null slug. Country and explicit city aliases are filtered server-side; existing record validation and direct-page eligibility are reapplied before emitting cards. Anonymous Supabase credentials and existing RLS remain the authorization boundary, including qualification restrictions. No new RPC, schema or policy changes.

The endpoint accepts exactly one recognized city ID; additional/duplicate parameters fail before database access. Results use `Cache-Control: private, no-store`. No cross-request application cache, private-media cache, geolocation, coordinates, storage tokens or new dependencies. Media continues through existing protected cover routes; event links remain canonical. Event detail, JSON-LD, sitemap, association, legal and indexing contracts are unchanged.

## Files changed

Created:
- `lib/marketing-cities.ts`
- `lib/marketing-cities.test.ts`
- `app/api/marketing/events/route.ts`
- `app/components/marketing/city-events.tsx`
- `app/components/marketing/event-card.tsx` (existing card markup extracted)
- `scripts/city-carousel-review.mjs`
- `docs/website-v2-mission4-6a/REPORT.md`

Modified:
- `lib/marketing-events.ts`
- `lib/marketing-events-server.ts`
- `app/components/marketing/event-section.tsx`
- `app/components/marketing/carousel.tsx`
- `app/marketing.css`
- `content/i18n/fr.json`, `en.json`, `de.json`, `it.json`, `es.json`
- `scripts/seo-http-smoke.mjs`

## Validation results

- `npm test`: 135 passed, zero failures; normalization, country separation, bounded queries, availability, default/fallback, selected-city filtering and eligibility, plus existing media/security suites.
- `npm run test:http`: 3,012 assertions, zero failures. Includes existing SEO, sitemap partitions, media authorization/withdrawal protections and new API parameter/DTO/budget checks. Fixture outage/timeout cases intentionally return 500; these are expected security regression scenarios, not live failures.
- HTTP test accounting now waits for HEAD SSR reads before attributing backend requests to the next request; initial five-query budget verified.
- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass (production Next.js build).
- `scripts/city-carousel-review.mjs`: pass in local Chrome/Playwright. Mouse drag, suppressed drag click, ordinary navigation, keyboard, reduced motion, native touch swipe, switching, stale-response race, empty/error states, five languages, 390px layout, zero scroll data requests. Switch/error data uses intercepted local API fixtures; initial SSR uses anonymous live reads. Touch is Chromium mobile emulation, not a physical iPhone.
- `scripts/website-route-review.mjs`: pass; 25 marketing routes, seven invalid routes, and 12/12 secure event covers available. Its legacy visual-review field is not used as browser evidence; separate browser checks and desktop/mobile screenshot inspection were performed.
- Read-only anonymous availability check: all four cities available; Lausanne default with 12 cards.
- `git diff --check`: pass.

## Limitations

Availability is a bounded snapshot, not an exhaustive aggregate. Probes inspect the first 12 SQL-matching candidates and fail closed on malformed or otherwise invalid records; this can hide a city if all sampled rows are unusable despite later valid records. No unbounded scan compensates for that case.

Known aliases are explicit and case-insensitive in the query. Arbitrary misspellings or stored whitespace variants are not exhaustively discovered. New countries/cities require configuration changes. Availability can change after SSR; switching rechecks eligibility, empty cities disappear, and refreshed pages rediscover availability. If the initial city becomes empty between probe and full fetch, the empty state is shown without recursively fetching other cities. No background polling or persistent client cache.

Card eligibility is evaluated at retrieval time; already displayed text is not live-revoked. Protected media remains independently authorized on each request under existing withdrawal protections.

No database writes, Flutter/Hunter changes, remote operations or production infrastructure changes. Awaiting approval for any commit, push or deployment.
