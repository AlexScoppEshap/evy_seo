# Evy SEO production baseline — Mission 2.5

Verified 17 November 2026, Europe/Zurich. This checkpoint establishes the existing production source; it does not implement the website redesign.

## Baseline and inventory

Parent Git/GitHub main: `e00bc46d6419586226e85ad1b2de40ff4d4e71c9`.

Production inspected through `seo.myevy.app`: `dpl_7zeHSV3B4wvzB4kWtNhERzgXdikF`, READY. The authenticated Vercel source inventory was fetched again. Its 91 application/configuration/assets files match the local tree exactly. The release-only `.vercelignore` was recovered unchanged, bringing the verified deployment package inventory to **92 files**.

`production-source-manifest.json` contains every deployed path, its Vercel SHA-1 and its locally calculated SHA-256. All 92 files also match the clean snapshot after installation, build and testing. No application file, dependency manifest or lockfile was changed during Mission 2.5. The November 7 claim CTA condition for the two existing creator IDs is preserved byte-for-byte.

`checkpoint-files.txt` lists the complete checkpoint tree, including previously tracked files; it is the exact inclusion inventory. In addition to the deployment package, the checkpoint preserves:

- All 15 existing `lib/*.test.ts` files and `lib/seo-fixtures.ts`.
- All eight reviewed validation/diagnostic scripts, including the synthetic test clock needed by HTTP tests.
- Existing Git ignore rules, agent guidance, README and ESLint configuration.
- This short report, the source manifest, the exact checkpoint inventory and a sanitized Git deployment policy record.

The complete checkpoint tree has **125 files**; the commit changes/adds **109 files** relative to the old Git baseline. All 92 deployed entries were also verified directly from the Git index before commit.

No blind `git add .` is used. The checkpoint is staged from explicit reviewed paths. Existing historical documents and local work are retained on disk.

## Exclusions

Intentionally outside this checkpoint:

- `.env.local` and every `.env*` file; no production credentials or secret values.
- `.vercel/`, `.git/`, `node_modules/`, `.next/`, `out/`, build output, caches, `next-env.d.ts` and `*.tsbuildinfo`.
- Historical audit/export directories under `docs/`, including Mission 1/2 and deployment evidence exports. The necessary production identity and hashes are condensed into this checkpoint's manifest.
- Local verification logs (`install.log`, `unit.log`, `lint.log`, `build.log`, `typecheck.log`, `http.log`), the temporary-snapshot location file and the staging preparation list in this report directory.
- The temporary clean verification checkout and its installed dependencies/build output, which live outside this repository.
- Flutter assets/source outside this repository, Supabase definitions and external runtime configuration/secrets.

An in-memory scan compared candidate text files against values from the local environment file and checked private-key markers: no matches. A targeted token/credential review found synthetic test credentials and rejection fixtures, not live secrets. No secret values were printed or saved in the report.

## Packaging differences

The restored root `.vercelignore` is byte-identical to the current deployment version:

```text
.env*
.git
node_modules
docs
```

The November release uploaded an explicitly selected 92-file package, not a full Git checkout. This checkpoint intentionally includes tests, scripts and developer configuration as well. The `.vercelignore` alone is therefore not an exact release allowlist. A future Git-triggered build may see more validation/tooling files than the original CLI upload. The clean build below includes those files and passes without changing the application source.

For exact source-package reproduction, copy only the 92 paths in `production-source-manifest.json` into a clean release directory and verify their hashes. Do not copy environment files; supply required runtime settings through the existing secure environment mechanism. This instruction does not authorize deployment.

The baseline includes source, assets, dependency lockfile and tests, not a byte-identical copy of Vercel's compiled Linux artifact. Build IDs, platform-specific dependencies and hosted runtime/environment configuration are separate inputs.

## Validation

A clean temporary snapshot containing the reviewed source and tooling was created without `.env.local`, previous build output or existing `node_modules`. It used **Node 24.22.3**, **npm 12.0.2**, and the unchanged lockfile on macOS ARM64. Production is configured for Node **24.x**. A cached Node 24 package's platform installation was completed outside the repository; the system default Node installation was not changed.

| Check | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed; 370 packages installed from the lockfile |
| `npm test` | 119 passed, 0 failed |
| `npm run lint` | Passed |
| `npm run build` | Passed; Next.js 16.4.5, default Turbopack, no custom build flags |
| `npm run typecheck` | Passed after build-generated types |
| `npm run test:http` | 2,965 assertions passed against isolated fixtures |
| Post-validation source comparison | All 92 deployment files unchanged in both workspace and clean snapshot |

The production build used synthetic anonymous configuration with loopback endpoints, not production credentials. HTTP validation used its existing isolated backend and local reverse-proxy/Apache fixtures, including all 256 partitions, 258 XML documents, query forwarding, TLS verification and rollback checks. No production service or database was mutated. The live anonymous audit command and browser preview were not run.

The build contains the existing homepage, event detail, event media, participant media, map, event sitemap, root sitemap, robots and proxy outputs. No marketing or locale route was introduced.

Existing security checks cover public/moderation/creator/recurrence eligibility, anonymous credential boundaries, safe media handling, withdrawal behavior, RSC/404 responses, sitemap failure cases, metadata and JSON-LD. Event canonicals and app UUID handoffs remain unchanged. Existing detail-page backend failures returning HTTP 500 remain as tested; this mission does not alter their behavior.

Non-fatal existing warnings: ESLint version deprecation; module-type inference for TypeScript tests; npm blocked the `unrs-resolver` postinstall under the current install-script policy. Lint/build/tests succeeded without changing that policy or any dependency.

`git diff --cached --check` reports one existing trailing space in `app/fonts/OFL.txt:21`. The deployed font license is intentionally preserved byte-for-byte instead of changing a production-manifest file for whitespace cleanup. No other whitespace issue was reported.

## Remaining reproducibility limits

- Vercel Node 24.x may advance to a different patch; its exact historical patch and Linux binaries are not recreated by this macOS build.
- Supabase URL/anonymous key, MapTiler key and any WordPress endpoint configuration are external runtime inputs. Their presence and correct scopes must be verified before a future release without committing them. RLS and backend contracts were not changed or re-audited live.
- WordPress still owns the marketing/legal site and supplies the Yoast index consumed by the merged root sitemap. Existing Apache/proxy behavior remains an external dependency.
- The optional `seo-detail-preview.mjs` uses external Flutter artwork/review images; it is preserved as an existing helper but is not needed for install, build, unit or HTTP validation. Browser review additionally requires Chrome; the local Apache harness requires its platform tools.
- No fresh browser/device qualification or dependency advisory audit is claimed. This checkpoint preserves the deployed dependency versions and protections.

## Push and deployment decision

The source checkpoint is suitable for version control and future review: its production-source comparison and local validation pass. **Pushing this commit to main is a deployment-triggering action, not a passive backup.**

The read-only project inspection recorded in `git-deployment-policy.json` confirms GitHub `AlexScoppEshap/evy_seo`, production branch `main`, `gitProviderOptions.createDeployments = enabled`, and no configured ignored-build command. No repository configuration was found disabling Git deployment. A push to main should therefore be expected to trigger an automatic Vercel production deployment, subject to GitHub/Vercel integration availability and platform checks.

Do not push without explicit approval acknowledging that deployment consequence. If a remote checkpoint without deployment is desired, agree on the required hosting/integration approach first; a different branch can also trigger preview deployment. No settings were changed to suppress deployment in this mission.

The local commit message is `chore: establish Evy SEO production baseline`. Its hash is reported after commit creation in the final handoff (a report cannot embed its own commit hash without changing that hash). No push or deployment is authorized or performed.
