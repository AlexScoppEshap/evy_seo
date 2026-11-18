import MarketingPageView from "@/app/components/marketing/marketing-page";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { marketingMetadata } from "@/lib/marketing-metadata";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "fr") notFound();
  return marketingMetadata(locale, "home", await getDictionary(locale));
}
export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "fr") notFound();
  return <MarketingPageView locale={locale} page="home" />;
}
