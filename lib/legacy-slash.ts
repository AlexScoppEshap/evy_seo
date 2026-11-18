const legacy = new Set(["privacy", "terms", "legal", "cookies", "community-guidelines", "child-safety", "support", "contact-us", "account-deletion", "download"]);
export function legacySlashRedirect(path: string): {path: string; status: 301 | 308} | null {
  if (legacy.has(path.slice(1))) return {path: `${path}/`, status: 301};
  if (path.endsWith("/") && path !== "/" && !legacy.has(path.slice(1, -1))) return {path: path.slice(0, -1), status: 308};
  return null;
}
