import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { marketingMetadata } from "./marketing-metadata.ts";
import {
  locales,
  pageKeys,
  marketingPath,
  isLocale,
  isMarketingPage,
} from "./i18n/config.ts";
const dictionary = (locale: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../content/i18n/${locale}.json`, import.meta.url),
      "utf8",
    ),
  );
test("five languages have complete matching dictionaries and unique canonical marketing routes", () => {
  const fr = dictionary("fr"),
    urls = new Set<string>();
  for (const locale of locales) {
    const d = dictionary(locale);
    assert.deepEqual(Object.keys(d).sort(), Object.keys(fr).sort());
    for (const key of Object.keys(fr)) {
      if (Array.isArray(fr[key])) assert.equal(d[key].length, fr[key].length);
      assert.ok(d[key]);
    }
    for (const page of pageKeys) {
      const url = marketingPath(locale, page);
      assert.ok(!urls.has(url));
      urls.add(url);
      const m = marketingMetadata(locale, page, d);
      assert.equal(m.title, d.metaTitles[pageKeys.indexOf(page)]);
      assert.equal(m.description, d.meta[pageKeys.indexOf(page)]);
      assert.equal(new Set(d.metaTitles).size, 5);
      assert.equal(m.alternates?.canonical, `https://myevy.app${url}`);
      assert.equal(Object.keys(m.alternates!.languages!).length, 6);
      assert.equal(
        m.alternates!.languages!["x-default"],
        `https://myevy.app${marketingPath("fr", page)}`,
      );
      for (const l of locales)
        assert.equal(
          m.alternates!.languages![l],
          `https://myevy.app${marketingPath(l, page)}`,
        );
      assert.deepEqual(m.robots, { index: false, follow: true });
    }
  }
  assert.equal(urls.size, 25);
  assert.equal(marketingPath("fr"), "/");
  assert.equal(isLocale("xx"), false);
  assert.equal(isMarketingPage("an-event-slug"), false);
});
test("marketing analytics identifiers do not install tracking or read browser storage", () => {
  const source = readFileSync(
    new URL("./marketing-analytics.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /fetch\(|localStorage|document\.cookie|sendBeacon|fbq\(/,
  );
});
