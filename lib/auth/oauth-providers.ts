/**
 * The social sign-ins this app offers, and what to call each one.
 *
 * A plain module — no `"use client"`, no `server-only` — because both halves read
 * it: the buttons on `/login` and `/signup`, and the admin console's server-side
 * user metrics. A constant imported from a client module into server code is a
 * client reference rather than the value (CLAUDE.md, "Stack specifics").
 *
 * The ids are Appwrite's own provider names, which is what `listIdentities` and
 * a session's `provider` field report, so a label can be looked up straight from
 * either.
 */

export const OAUTH_PROVIDERS = ["google", "github"] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];

export const OAUTH_PROVIDER_LABEL: Record<OAuthProviderId, string> = {
  google: "Google",
  github: "GitHub",
};

export function isOAuthProvider(value: string): value is OAuthProviderId {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/**
 * How an account signs in, for a person to read: "Email", "Google", "GitHub".
 * An identity from a provider this list does not know is shown by its raw name
 * rather than guessed at.
 */
export function signInMethodLabel(method: string): string {
  if (method === "email") return "Email";
  return isOAuthProvider(method) ? OAUTH_PROVIDER_LABEL[method] : method;
}
