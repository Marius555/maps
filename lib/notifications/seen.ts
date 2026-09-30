import "server-only";

import { admin } from "@/lib/appwrite/admin";

/**
 * When this account last opened the Notifications page — the one piece of read
 * state notifications have.
 *
 * On the account's prefs rather than a row per notification per account, so a
 * broadcast stays one row however many accounts there are. Merged into the
 * existing prefs, never written over them: `updatePrefs` replaces the whole
 * object, and the tutorial stamps and `deletionStartedAt` live there too — the
 * same rule `lib/auth/tutorial.ts` follows.
 */
export const NOTIFICATIONS_SEEN_PREF = "notificationsSeenAt";

export type SeenState = {
  seenAt: string | null;
  /** When the account was created — the baseline before it has seen anything. */
  createdAt: string | null;
};

/**
 * One call for both stamps: the user record carries its prefs.
 *
 * A failed read is "nothing known", which `toFeed` draws as everything unread.
 * A count that is too high is recoverable by opening the page; a thrown error
 * here would take the sidebar's request down with it.
 */
export async function readSeenState(userId: string): Promise<SeenState> {
  try {
    const user = await admin.users.get({ userId });
    const prefs = (user.prefs ?? {}) as Record<string, unknown>;
    const seenAt = prefs[NOTIFICATIONS_SEEN_PREF];

    return {
      seenAt: typeof seenAt === "string" ? seenAt : null,
      createdAt: user.registration || user.$createdAt || null,
    };
  } catch (error) {
    console.error("Couldn't read when notifications were last seen:", error);
    return { seenAt: null, createdAt: null };
  }
}

export async function markNotificationsSeen(userId: string): Promise<void> {
  const prefs: Record<string, unknown> = await admin.users.getPrefs({ userId });

  await admin.users.updatePrefs({
    userId,
    prefs: { ...prefs, [NOTIFICATIONS_SEEN_PREF]: new Date().toISOString() },
  });
}
