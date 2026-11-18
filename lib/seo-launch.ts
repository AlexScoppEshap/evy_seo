// Server-side launch gate. Set only for an approved production build and runtime.
// VERCEL_ENV prevents an inherited launch flag from indexing previews.
export function productionIndexingEnabled(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return env.NODE_ENV === "production" && env.VERCEL_ENV === "production" &&
    env.EVY_PUBLIC_INDEXING === "enabled" && env.EVY_SITE_ORIGIN === "https://myevy.app";
}
export function requestIndexingEnabled(url: string, env: Partial<NodeJS.ProcessEnv> = process.env) {
  const target = new URL(url);
  return productionIndexingEnabled(env) && target.hostname === "myevy.app";
}
