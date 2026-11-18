import { sitemapResponse, sitePagesXml } from '@/lib/site-sitemap';
export function GET(request: Request) { return sitemapResponse(request, sitePagesXml); }
