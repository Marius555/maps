/**
 * Which release this build is. Stamped at build time by `next.config.ts` from
 * package.json and the commit (`scripts/build-info.mjs`), so it is the same
 * answer on the server and in the browser.
 *
 * A plain module, not `"use client"`. A constant imported from a client module
 * into a server component is a client reference, not the value (CLAUDE.md).
 *
 * `npm run release` moves the version. docs/notes/versioning.md has the details.
 */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

/** Short sha, or "" when the build could not tell (scripts/build-info.mjs). */
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? "";

/** ISO timestamp of the build. */
export const BUILT_AT = process.env.NEXT_PUBLIC_BUILT_AT ?? "";

/** "v0.9.0 · 4e3d24d", or "v0.9.0" when the commit is unknown. */
export function versionLabel(): string {
  return APP_COMMIT ? `v${APP_VERSION} · ${APP_COMMIT}` : `v${APP_VERSION}`;
}
