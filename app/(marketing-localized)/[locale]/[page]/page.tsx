import MarketingPageView from "@/app/components/marketing/marketing-page";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { marketingMetadata } from "@/lib/marketing-metadata";
import { notFound } from "next/navigation";
import { isLocale, isMarketingPage } from "@/lib/i18n/config";
type Props = { params: Promise<{ locale: string; page: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale, page } = await params;
  if (
    !isLocale(locale) ||
    locale === "fr" ||
    !isMarketingPage(page) ||
    page === "home"
  )
    notFound();
  return marketingMetadata(locale, page, await getDictionary(locale));
}
export default async function Page({ params }: Props) {
  const { locale, page } = await params;
  if (
    !isLocale(locale) ||
    locale === "fr" ||
    !isMarketingPage(page) ||
    page === "home"
  )
    notFound();
  return <MarketingPageView locale={locale} page={page} />;
}
