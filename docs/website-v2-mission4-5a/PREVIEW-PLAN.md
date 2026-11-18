# Preview plan — requires subsequent explicit approval

## Identity

- Branch: `feature/website-v2`.
- Candidate commit: the commit containing this plan (`git rev-parse feature/website-v2`); exact SHA provided in the final handoff.
- Repository: `https://github.com/AlexScoppEshap/evy_seo`.
- Vercel team/project: `evy7/evy-seo`, `prj_kJoQTcE00qVNLI2UGKDuPue0tqzK`.
- Production branch: `main` as freshly inspected; do not push/merge there.
- Node 24.x; install from package-lock.json; current default `npm run build` passes.

No Preview URL exists for this unpushed branch yet. Expect a Vercel-assigned HTTPS `*.vercel.app` URL. A likely branch-alias pattern is `https://evy-seo-git-feature-website-v2-evy7.vercel.app`, but do not treat that as an allocated/verified URL. Use the actual deployment URL returned by Vercel after a separately authorized deployment. Do not assign myevy.app, www.myevy.app, app.myevy.app or seo.myevy.app to the Preview.

## Required Preview configuration

| Variable | Requirement |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Existing correct HTTPS public Supabase endpoint; currently scoped to Preview and production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Existing anon JWT or publishable key only; currently scoped to Preview and production; actual sensitive value not export-verifiable |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Optional server-only alternatives; they take precedence, so do not introduce conflicting values |
| `MAPTILER_API_KEY` | Needed for working event maps; currently production-only; Preview configuration requires approval |
| `MAPTILER_API_ORIGIN` | Leave unset for the existing provider; never use local fixture overrides on Vercel |
| `EVY_PUBLIC_INDEXING` | Unset or `disabled` for Preview |
| `EVY_SITE_ORIGIN` | If configured, `https://myevy.app`; never use Preview URL as canonical origin |
| `VERCEL_ENV` | Platform-supplied `preview`; do not override |
| `NODE_ENV` | Framework/platform-supplied production build mode; does not alone enable indexing |

`WORDPRESS_SITEMAP_INDEX_URL` is no longer used by the application. No Resend/SMTP, geographic recovery, service-role or database connection secret is needed for this candidate. Do not provision unnecessary credentials. No environment values are stored in this document or the commit.

## Future authorized deployment procedure

1. Verify the exact candidate SHA and review the manifest. Confirm that remote main and Vercel production branch settings remain as documented. Confirm no pending branch change or deployment automation targets production.
2. Resolve Preview configuration gates above, using Preview-only scope and a separate authorization; never change production variables for a Preview.
3. With explicit push/deployment approval, run `git push origin feature/website-v2`. This is expected to initiate a Vercel Preview automatically; it is not a passive remote backup. Do not run `vercel --prod`, promote a deployment, change domain aliases, merge main or change DNS.
4. Inspect Vercel deployment target **Preview**, Git branch and exact SHA before accepting the result. Stop if target is production or SHA differs. Record the actual immutable Preview URL and branch alias, if any.
5. Keep any existing deployment protection enabled. If protection prevents unauthenticated association validation, record that limitation; do not disable protection without approval.

## Verification on the actual Preview

- Inspect response `X-Robots-Tag: noindex`, robots disallow and noindex marketing/legal metadata. Canonicals/hreflang point only to myevy.app.
- Check all five homepages and marketing routes, nine historical legal URLs/301 trailing slashes, `/download/`, header/footer/assets and mobile layout.
- AASA and assetlinks: 200 JSON, no application redirect/authentication, unchanged identifiers/fingerprints. Distinguish any platform-level Preview protection from app behavior.
- Deep links: inspect Location only with synthetic tokens, `redirect: manual`; never follow into a real recovery/OAuth flow. Verify raw query preservation, no-store and no-referrer. Do not log real tokens.
- `/sitemap.xml` has 257 canonical leaves; `/page-sitemap.xml` has zero Preview page entries; legacy index aliases redirect once. Check all 256 partitions without altering data; do not leak any private event information.
- Public event details and cover routes work; unauthorized/withdrawn media stays unavailable, private/no-store preserved. Test withdrawal with isolated fixtures, never by changing production data.
- Verify map behavior once approved Preview configuration is present. Verify public-key guard failure paths using fixtures, not by changing production secrets.
- Confirm no application/data/schema/RLS/Flutter mutations, no launch-indexing enablement and no production domain changes.

The repository's route-review scripts deliberately enforce loopback and must not be blindly pointed at a remote URL. Keep them for local regression; perform a separately reviewed read-only hosted checklist or prepare a host-allowlisted runner later.

## Rollback/abort

At present there is nothing to roll back in production. Do not reset the working tree or discard deferred work.

For a later faulty Preview: stop review and do not promote/merge. With separate authorization, cancel that Preview build or remove its Preview deployment/alias, or revert the offending feature-branch commit and rebuild Preview. Preserve the local checkpoint and baseline; avoid force-pushing main. None of these actions requires DNS changes. A full production rollback is a separate operation involving the qualified application and WordPress/Apache/DNS baseline; it is not authorized by this plan.
