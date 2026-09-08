/**
 * Public Appwrite configuration. Client-safe — only NEXT_PUBLIC_ values live here.
 * Anything secret belongs in lib/env.ts.
 */

export const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
export const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;

/** Appwrite's own session cookie name. Matching it keeps the SDK happy. */
export const SESSION_COOKIE = `a_session_${APPWRITE_PROJECT_ID}`;

export const TABLES = {
  maps: "maps",
  places: "places",
  shapes: "shapes",
  groups: "groups",
  cardDesigns: "cardDesigns",
  subscriptions: "subscriptions",
  mapSessions: "mapSessions",
  mapDaily: "mapDaily",
} as const;
