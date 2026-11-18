// Read-only local HTTP qualification. No production mutations or browser automation.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const origin = process.env.WEBSITE_REVIEW_ORIGIN ?? "http://127.0.0.1:3213";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(origin).hostname),
  "Local preview required",
);
const locales = ["fr", "en", "de", "it", "es"],
  pages = ["", "meetups", "organizers", "download", "events"];
const path = (l, p) => l === "fr" && p === "download" ? "/download/" : `${l === "fr" ? "" : "/" + l}${p ? "/" + p : ""}` || "/";
const checked = [],
  assets = new Set(),
  links = new Set();
for (const locale of locales)
  for (const page of pages) {
    const url = path(locale, page),
      r = await fetch(origin + url),
      html = await r.text();
    assert.equal(r.status, 200, url);
    assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`), url);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, url);
    assert.ok(
      html.includes(`rel="canonical" href="https://myevy.app${url}"`),
      url,
    );
    assert.match(html, /<meta name="robots" content="noindex, follow"/);
    for (const l of locales)
      assert.ok(
        html.includes(
          `hrefLang="${l}" href="https://myevy.app${path(l, page)}"`,
        ),
        `${url} alternate ${l}`,
      );
    assert.ok(
      html.includes(
        `hrefLang="x-default" href="https://myevy.app${path("fr", page)}"`,
      ),
    );
    assert.match(html, /<meta property="og:title"/);
    assert.match(
      html,
      /<meta name="twitter:card" content="summary_large_image"/,
    );
    assert.doesNotMatch(
      html,
      /SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE|ik-storage\?|private-token|synthetic_map_key|fbq\(/,
    );
    for (const m of html.matchAll(/href="(\/[^"#]*)"/g))
      if (!m[1].startsWith("/_next/")) links.add(m[1].replaceAll("&amp;", "&"));
    for (const m of html.matchAll(
      /src="(\/(?:marketing\/|_next\/image\?|events\/)[^"#]*)"/g,
    ))
      assets.add(m[1].replaceAll("&amp;", "&"));
    checked.push({
      path: url,
      locale,
      status: r.status,
      bytes: Buffer.byteLength(html),
      cards: (html.match(/class="event-card"/g) || []).length,
    });
  }
for (const path of links)
  assert.equal(
    (await fetch(origin + path, { method: "HEAD" })).status,
    200,
    path,
  );
const media = { available: 0, unavailable: 0 };
for (const path of assets) {
  const status = (await fetch(origin + path, { method: "HEAD" })).status;
  if (path.startsWith("/events/")) {
    // Live media may be absent or withdrawn independently of the public event.
    // This is expected to activate EventCoverImage's fallback, not a substitute URL.
    assert.ok([200, 404].includes(status), `${path}: ${status}`);
    media[status === 200 ? "available" : "unavailable"]++;
  } else assert.equal(status, 200, path);
}
for (const path of [
  "/fr",
  "/xx",
  "/en/unknown",
  "/en/events/friday-edition-1",
  "/de/events/friday-edition-1",
  "/it/events/friday-edition-1",
  "/es/events/friday-edition-1",
])
  assert.equal((await fetch(origin + path)).status, 404, path);
const report = {
  routes: checked,
  localLinks: links.size,
  assets: assets.size,
  secureEventCovers: media,
  invalidRoutes: 7,
  result: "PASS",
  visualBrowserReview: "unavailable: browser access host unavailable",
};
if (process.env.WEBSITE_REVIEW_OUTPUT)
  await writeFile(
    process.env.WEBSITE_REVIEW_OUTPUT,
    JSON.stringify(report, null, 2) + "\n",
  );
console.log(JSON.stringify(report, null, 2));
