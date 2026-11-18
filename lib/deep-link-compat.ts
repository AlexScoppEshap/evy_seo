// Fixed existing Flutter web destination. Never parse/rebuild query parameters:
// signed tokens, duplicate parameters, escaping and ordering must survive intact.
export function deepLinkDestination(input: string): string | null {
  const url = new URL(input);
  if (/^\/event\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(url.pathname) ||
      /^\/user\/[^/]+\/?$/.test(url.pathname) || /^\/account-recovery\/?$/.test(url.pathname)) {
    return `https://app.myevy.app${url.pathname}${url.search}`;
  }
  return null;
}
