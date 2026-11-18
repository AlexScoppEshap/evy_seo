export const locales = ["fr", "en", "de", "it", "es"] as const;
export type Locale = (typeof locales)[number];
export const pageKeys = [
  "home",
  "meetups",
  "organizers",
  "download",
  "events",
] as const;
export type MarketingPage = (typeof pageKeys)[number];
export const languageNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  de: "Deutsch",
  it: "Italiano",
  es: "Español",
};
export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}
export function isMarketingPage(value: string): value is MarketingPage {
  return pageKeys.some((page) => page === value);
}
export function marketingPath(locale: Locale, page: MarketingPage = "home") {
  if (locale === "fr" && page === "download") return "/download/";
  const prefix = locale === "fr" ? "" : `/${locale}`;
  return page === "home" ? prefix || "/" : `${prefix}/${page}`;
}
export const APP_URL = "https://app.myevy.app";
export const STORE_URLS = {
  ios: "https://apps.apple.com/us/app/evy-find-your-vibe/id6803257184",
  android: "https://play.google.com/store/apps/details?id=com.eshap.evy",
};
export const legalPaths = [
  "privacy",
  "terms",
  "legal",
  "cookies",
  "community-guidelines",
  "child-safety",
  "account-deletion",
  "support",
  "contact-us",
];
