/**
 * Take credentials out of a URL before it is sent anywhere: invite tokens, and
 * the secret on an emailed confirmation or reset link (`redactLinkSecrets`).
 *
 * An invite link is a working credential for a week (lib/team/token.ts), and
 * the token sits in its path — `/invite/<token>` — and again in the `next`
 * parameter of the login and signup pages a signed-out invitee is sent through.
 * PostHog records `$current_url`, `$pathname` and `$referrer` on every event, so
 * without this an analytics dashboard would be a list of links into people's
 * teams.
 *
 * Pure and dependency-free, so it is tested directly (redact.test.ts).
 */

const INVITE_PATH = /\/invite\/[A-Za-z0-9_-]+/g;
const REDACTED = "/invite/[redacted]";

export function redactInviteTokens(value: string): string {
  if (!value.includes("invite")) return value;

  // `next=%2Finvite%2F<token>` as well as the plain path, since the login and
  // signup pages carry it encoded.
  return value
    .replace(INVITE_PATH, REDACTED)
    .replace(/%2Finvite%2F[A-Za-z0-9_-]+/gi, "%2Finvite%2F%5Bredacted%5D");
}

/**
 * Take emailed-link secrets out of a URL: `?secret=` on `/verify-email` (a
 * confirmation link) and `/reset-password` (a reset link, which signs in
 * whoever holds it within the hour). Both pages carry the token in their own
 * address because a press on the page is what spends it.
 */
const SECRET_PARAM = /([?&]secret=)[^&#]*/gi;

export function redactLinkSecrets(value: string): string {
  if (!value.includes("secret=")) return value;

  return value.replace(SECRET_PARAM, "$1[redacted]");
}

/** Every credential a URL in this app can carry. */
export function redactUrl(value: string): string {
  return redactLinkSecrets(redactInviteTokens(value));
}

/** The event properties PostHog fills from the address bar. */
const URL_PROPERTIES = ["$current_url", "$pathname", "$referrer", "$initial_referrer"] as const;

export function redactEventUrls<T extends { properties?: Record<string, unknown> }>(
  event: T,
): T {
  const properties = event.properties;
  if (!properties) return event;

  for (const key of URL_PROPERTIES) {
    const value = properties[key];
    if (typeof value === "string") properties[key] = redactUrl(value);
  }

  return event;
}
