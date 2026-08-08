/**
 * Constrain a `?next=` value to a path on this site.
 *
 * Without this, `/login?next=https://evil.example` turns our login page into an
 * open redirect. Protocol-relative URLs (`//evil.example`) are the case that
 * catches people out — the browser treats them as absolute.
 */
export function safeRedirect(
  value: string | string[] | undefined,
  fallback = "/maps",
): string {
  const path = Array.isArray(value) ? value[0] : value;

  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (path.startsWith("/\\")) return fallback;

  return path;
}
