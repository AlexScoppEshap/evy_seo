type ShareNavigator = { share?: (data: { title: string; url: string }) => Promise<void>; clipboard?: { writeText(text: string): Promise<void> } }

export async function sharePublicEvent(data: { title: string; url: string }, browser: ShareNavigator): Promise<'shared' | 'copied' | 'cancelled' | 'unavailable'> {
  if (browser.share) {
    try { await browser.share(data); return 'shared' }
    catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    if (browser.clipboard) { await browser.clipboard.writeText(data.url); return 'copied' }
  } catch { /* Keep the explicit email link and browser address as fallbacks. */ }
  return 'unavailable'
}
