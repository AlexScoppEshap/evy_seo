import "server-only";
import type fr from "@/content/i18n/fr.json";
import type { Locale } from "./config";
export type Dictionary = typeof fr;
const dictionaries = {
  fr: () => import("@/content/i18n/fr.json").then((m) => m.default),
  en: () => import("@/content/i18n/en.json").then((m) => m.default),
  de: () => import("@/content/i18n/de.json").then((m) => m.default),
  it: () => import("@/content/i18n/it.json").then((m) => m.default),
  es: () => import("@/content/i18n/es.json").then((m) => m.default),
} satisfies Record<Locale, () => Promise<Dictionary>>;
export const getDictionary = (locale: Locale): Promise<Dictionary> =>
  dictionaries[locale]();
