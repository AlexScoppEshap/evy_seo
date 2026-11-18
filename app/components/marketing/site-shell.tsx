import Image from "next/image";
import {
  APP_URL,
  languageNames,
  legalPaths,
  locales,
  marketingPath,
  type Locale,
  type MarketingPage,
} from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
export function Brand() {
  return (
    <span className="brand">
      <Image
        src="/marketing/evy-logo.png"
        alt="Evy — Find your vibe"
        width={945}
        height={989}
        sizes="140px"
      />
    </span>
  );
}
export function LanguageSwitcher({
  locale,
  page,
  d,
  inline = false,
}: {
  locale: Locale;
  page: MarketingPage;
  d: Dictionary;
  inline?: boolean;
}) {
  const links = locales.map((l) => (
    <a
      key={l}
      href={marketingPath(l, page)}
      lang={l}
      hrefLang={l}
      aria-current={l === locale ? "page" : undefined}
    >
      {languageNames[l]}
      {l === locale && <span aria-hidden="true"> ↗</span>}
    </a>
  ));
  return inline ? (
    <nav className="language-inline" aria-label={d.language}>
      {links}
    </nav>
  ) : (
    <details className="language-picker">
      <summary aria-label={`${d.language}: ${languageNames[locale]}`}>
        {locale.toUpperCase()} <span aria-hidden="true">⌄</span>
      </summary>
      <nav aria-label={d.language}>{links}</nav>
    </details>
  );
}
export function Header({
  locale,
  page,
  d,
}: {
  locale: Locale;
  page: MarketingPage;
  d: Dictionary;
}) {
  const nav = (["events", "meetups", "organizers"] as const).map((p, i) => (
    <a
      key={p}
      href={marketingPath(locale, p)}
      aria-current={page === p ? "page" : undefined}
    >
      {d.nav[i]}
    </a>
  ));
  return (
    <>
      <a className="skip-link" href="#main">
        {d.skip}
      </a>
      <header className="site-header">
        <a href={marketingPath(locale)} aria-label="Evy — Find your vibe">
          <Brand />
        </a>
        <nav className="desktop-nav" aria-label={d.menu}>
          {nav}
        </nav>
        <div className="header-actions">
          <LanguageSwitcher locale={locale} page={page} d={d} />
          <a
            href={marketingPath(locale, "download")}
            className="button button-small header-download"
          >
            {d.download} <span aria-hidden="true">↗</span>
          </a>
          <details className="mobile-menu">
            <summary aria-label={d.menu}>
              <span aria-hidden="true">☰</span>
            </summary>
            <nav aria-label={d.menu}>
              {nav}
              <a href={marketingPath(locale, "download")}>{d.download}</a>
            </nav>
          </details>
        </div>
      </header>
    </>
  );
}
export function Footer({
  locale,
  page,
  d,
}: {
  locale: Locale;
  page: MarketingPage;
  d: Dictionary;
}) {
  return (
    <footer className="site-footer container">
      <div className="footer-top">
        <div>
          <a href={marketingPath(locale)} aria-label="Evy">
            <Brand />
          </a>
          <p className="muted footer-line">{d.footerLine}</p>
        </div>
        <nav aria-label={d.menu}>
          {(["events", "meetups", "organizers", "download"] as const).map(
            (p, i) => (
              <a key={p} href={marketingPath(locale, p)}>
                {d.nav[i]}
              </a>
            ),
          )}
          <a href={APP_URL}>{d.openApp} ↗</a>
        </nav>
        <nav aria-label={d.legal[2]}>
          {legalPaths.map((p, i) => (
            <a key={p} href={`/${p}/`}>
              {d.legal[i]}
            </a>
          ))}
        </nav>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} Evy. {d.copyright}
        </span>
        <LanguageSwitcher locale={locale} page={page} d={d} inline />
      </div>
    </footer>
  );
}
