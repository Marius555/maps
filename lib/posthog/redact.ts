/**
 * Take invite tokens out of a URL before it is sent anywhere.
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

/** The event properties PostHog fills from the address bar. */
const URL_PROPERTIES = ["$current_url", "$pathname", "$referrer", "$initial_referrer"] as const;

export function redactEventUrls<T extends { properties?: Record<string, unknown> }>(
  event: T,
): T {
  const properties = event.properties;
  if (!properties) return event;

  for (const key of URL_PROPERTIES) {
    const value = properties[key];
    if (typeof value === "string") properties[key] = redactInviteTokens(value);
  }

  return event;
}
