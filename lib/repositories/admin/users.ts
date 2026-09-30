import "server-only";

import { Query } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";

/**
 * Cross-account reads for the operator console — this whole folder.
 *
 * **Deliberately not owner-scoped, and that is why it is its own folder.**
 * Every other repository takes a `RepoContext` and cannot read past the caller's
 * own rows; these read everybody's. Their only callers are the loaders in
 * `lib/admin/metrics`, each of which calls `requireAdmin()` before it calls
 * anything here. Nothing in a customer route may import from this folder.
 */

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  verified: boolean;
  enabled: boolean;
  /** ISO, or "" for an account that has never been active. */
  accessedAt: string;
};

const PAGE = 100;

/** Read at most this many accounts per page load; the page says when it bound. */
export const USER_READ_CAP = 5_000;

export async function listAllUsers(): Promise<{
  users: AdminUser[];
  total: number;
  truncated: boolean;
}> {
  const users: AdminUser[] = [];
  let cursor: string | undefined;
  let total = 0;

  while (users.length < USER_READ_CAP) {
    const page = await admin.users.list({
      queries: [
        Query.orderDesc("$createdAt"),
        Query.limit(PAGE),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });

    total = page.total;

    for (const user of page.users) {
      users.push({
        id: user.$id,
        name: user.name,
        email: user.email,
        createdAt: user.registration || user.$createdAt,
        verified: user.emailVerification,
        enabled: user.status,
        accessedAt: user.accessedAt ?? "",
      });
    }

    if (page.users.length < PAGE) break;
    cursor = page.users[page.users.length - 1].$id;
  }

  return { users, total: Math.max(total, users.length), truncated: users.length < total };
}

/**
 * Which accounts have a Google identity. An account without one signed up with
 * email and password — Appwrite records no identity for that.
 */
export async function listOAuthUserIds(): Promise<Map<string, string>> {
  const providers = new Map<string, string>();
  let cursor: string | undefined;

  for (let pageIndex = 0; pageIndex < USER_READ_CAP / PAGE; pageIndex += 1) {
    const page = await admin.users.listIdentities({
      queries: [Query.limit(PAGE), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
    });

    for (const identity of page.identities) {
      providers.set(identity.userId, identity.provider);
    }

    if (page.identities.length < PAGE) break;
    cursor = page.identities[page.identities.length - 1].$id;
  }

  return providers;
}

/**
 * The account an address belongs to, or null — the Notifications page names a
 * recipient by email rather than by Appwrite id.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const page = await admin.users.list({
    queries: [Query.equal("email", email.trim().toLowerCase()), Query.limit(1)],
  });

  return page.users[0]?.$id ?? null;
}

/**
 * Email by account id, for the few accounts a page names. Deleted accounts are
 * simply absent from the map.
 */
export async function emailsForUserIds(ids: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const unique = [...new Set(ids)];

  for (let start = 0; start < unique.length; start += PAGE) {
    const chunk = unique.slice(start, start + PAGE);
    const page = await admin.users.list({
      queries: [Query.equal("$id", chunk), Query.limit(PAGE)],
    });

    for (const user of page.users) emails.set(user.$id, user.email);
  }

  return emails;
}
