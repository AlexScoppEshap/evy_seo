import { sitemapResponse, siteIndexXml } from '@/lib/site-sitemap';
export function GET(request: Request) { return sitemapResponse(request, siteIndexXml); }
