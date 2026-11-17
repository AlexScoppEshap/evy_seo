// Pure policy helpers; credentials are read only by the server-only client.
export const PUBLIC_BACKEND_TIMEOUT_MS = 5_000

export function assertAnonymousKey(key: string | undefined): asserts key is string {
  const invalid = () => { throw new Error('Public backend configuration is invalid') }
  if (!key || key !== key.trim()) return invalid()
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return
  const parts = key.split('.')
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return invalid()
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (!payload || typeof payload !== 'object' || !('role' in payload) || payload.role !== 'anon') return invalid()
  } catch { return invalid() }
  // This is a misconfiguration guard, not signature verification. Supabase
  // still authenticates the key. Viewer and service-role JWTs are never accepted.
}

export function createPublicFetch(
  upstream: typeof fetch = fetch,
  timeoutMs = PUBLIC_BACKEND_TIMEOUT_MS,
): typeof fetch {
  return async (input, init) => {
    const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout
    const response = await upstream(input, { ...init, signal, cache: 'no-store' })
    // Keep the deadline through JSON body reading, not just response headers.
    const body = await response.arrayBuffer()
    return new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    })
  }
}
