import MarketingPageView from "@/app/components/marketing/marketing-page";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { marketingMetadata } from "@/lib/marketing-metadata";
export async function generateMetadata() {
  return marketingMetadata("fr", "download", await getDictionary("fr"));
}
export default function Page() {
  return <MarketingPageView locale="fr" page="download" />;
}
