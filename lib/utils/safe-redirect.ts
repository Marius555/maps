/**
 * Constrain a `?next=` value to a path on this site.
 *
 * Without this, `/login?next=https://evil.example` turns our login page into an
 * open redirect. Protocol-relative URLs (`//evil.example`) are the case that
 * catches people out — the browser treats them as absolute.
 *
 * Prefix checks alone are not enough: the URL parser deletes tabs and newlines
 * anywhere in a URL and reads `\` as `/`, so `/\t/evil.example` passes every
 * `startsWith` and still lands on another host. Both are refused outright, and
 * the result is then resolved against a placeholder origin to confirm it stays
 * on it — the same parse the browser will do.
 */
const PROBE_ORIGIN = "https://x.invalid";

export function safeRedirect(
  value: string | string[] | undefined,
  fallback = "/maps",
): string {
  const path = Array.isArray(value) ? value[0] : value;

  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(path)) return fallback;

  try {
    if (new URL(path, PROBE_ORIGIN).origin !== PROBE_ORIGIN) return fallback;
  } catch {
    return fallback;
  }

  return path;
}
