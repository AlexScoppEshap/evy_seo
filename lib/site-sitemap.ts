import { SITEMAP_PARTITIONS, escapeXml } from './event-sitemap.ts';
import { locales, pageKeys, marketingPath, legalPaths } from './i18n/config.ts';
import { productionIndexingEnabled } from './seo-launch.ts';
const origin = 'https://myevy.app';
const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const declaration = '<?xml version="1.0" encoding="UTF-8"?>\n';
export function sitePageUrls(env: Partial<NodeJS.ProcessEnv> = process.env) {
  if (!productionIndexingEnabled(env)) return [];
  return [...locales.flatMap(locale => pageKeys.map(page => origin + marketingPath(locale, page))),
    ...legalPaths.map(slug => `${origin}/${slug}/`)];
}
export function sitePagesXml(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return `${declaration}<urlset xmlns="${namespace}">\n` +
    sitePageUrls(env).map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n') + '\n</urlset>';
}
export function siteIndexXml() {
  // One flat index: no nested event index, no WordPress fetch, no invented lastmod.
  const leaves = [`${origin}/page-sitemap.xml`, ...SITEMAP_PARTITIONS.map(p => `${origin}/events-sitemap.xml?partition=${p}`)];
  return `${declaration}<sitemapindex xmlns="${namespace}">\n` +
    leaves.map(url => `  <sitemap><loc>${escapeXml(url)}</loc></sitemap>`).join('\n') + '\n</sitemapindex>';
}
export function sitemapResponse(request: Request, xml: () => string) {
  const headers = {'Cache-Control': 'no-store', 'Content-Type': 'application/xml; charset=utf-8'};
  if (new URL(request.url).search) return new Response('Invalid sitemap query', {status: 400, headers});
  return new Response(xml(), {headers});
}
export function legacySitemapRedirect(request: Request) {
  if (new URL(request.url).search) return new Response('Invalid sitemap query', {status: 400, headers: {'Cache-Control':'no-store'}});
  return new Response(null, {status: 301, headers: {Location: '/sitemap.xml', 'Cache-Control':'no-store'}});
}
