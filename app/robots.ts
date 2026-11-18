import { productionIndexingEnabled } from "@/lib/seo-launch";
export const dynamic = "force-dynamic";
export default function robots() {
  return {
    rules: productionIndexingEnabled() ? {userAgent: '*', allow: '/'} : {userAgent: '*', disallow: '/'},
    sitemap: 'https://myevy.app/sitemap.xml',
  };
}
