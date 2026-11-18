import { manrope } from "@/app/brand-font";
import "@/app/globals.css";
import "@/app/marketing.css";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "fr") notFound();
  return (
    <html lang={locale} className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
