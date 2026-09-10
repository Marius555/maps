"use client";

import { Account, Client, OAuthProvider } from "appwrite";

import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "./config";

/**
 * Browser Appwrite client — public endpoint and project id only, never a key.
 *
 * The dashboard talks to our own REST API, which holds the session cookie, so
 * almost nothing needs this. The exception is the *first* half of an OAuth
 * sign-in, which is a browser navigation and therefore cannot happen on the
 * server; everything after the redirect comes back through `/api/auth/oauth`.
 *
 * This file is also where the CLAUDE.md §5 boundary is kept: `eslint.config.mjs`
 * forbids `app/**` and `components/**` from importing the SDK at all, so the
 * `OAuthProvider` enum and the `Account` object stay behind this module and the
 * button just calls a function.
 */
export function createBrowserClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);

  return { client, account: new Account(client) };
}

/**
 * Hands the browser to Google, asking for a **token** rather than a session.
 *
 * `createOAuth2Session` would have Appwrite set its own cookie on its own
 * domain, which our server cannot read — `proxy.ts`, the dashboard layout and
 * every `withAuth` handler all authorise off the httpOnly cookie *we* write, so
 * that session would be invisible to all three. The token variant appends
 * `userId` and `secret` to the success URL instead, and `/auth/success` posts
 * them to our own origin where a real session can be made.
 *
 * **This does not return.** `createOAuth2Token` is typed `void | string`: it
 * assigns `window.location.href` and the browser leaves. Nothing may be
 * scheduled after it, and there is nothing to await — the `Promise` its callers
 * might expect does not exist.
 */
export function startGoogleSignIn(origin: string): void {
  const { account } = createBrowserClient();

  account.createOAuth2Token({
    provider: OAuthProvider.Google,
    success: `${origin}/auth/success`,
    failure: `${origin}/auth/failure`,
  });
}
