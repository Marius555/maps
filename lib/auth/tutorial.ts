import "server-only";

import { cache } from "react";

import { admin } from "@/lib/appwrite/admin";
import { TUTORIAL_IDS, type TutorialId } from "@/lib/onboarding/tutorials";

/**
 * The onboarding overlays: whether this account still has each one to see.
 *
 * **"Seen" means dismissed, never merely shown.** The stamp is written only when
 * the overlay is closed — its X, Escape, or pressing what it points at — so
 * somebody who signs up and closes the tab gets it again next time rather than
 * having spent it unread.
 *
 * On the account's prefs rather than in the browser, because the person it is
 * for is new: they are the one most likely to come back on a different device.
 * Merged into the existing prefs rather than written over them — `updatePrefs`
 * replaces the whole object, and `deletionStartedAt` lives there too.
 *
 * One stamp per overlay. The editor's keeps the name it shipped with, so an
 * account that already closed it is not shown it again.
 */
export const TUTORIAL_PREFS: Record<TutorialId, string> = {
  maps: "mapsTutorialSeenAt",
  editor: "tutorialSeenAt",
  card: "cardTutorialSeenAt",
  publish: "publishTutorialSeenAt",
};

/**
 * One read per request: the dashboard layout asks on every full load, and the
 * page under it usually asks too.
 */
const readPrefs = cache(
  async (userId: string): Promise<Record<string, unknown>> =>
    admin.users.getPrefs({ userId }),
);

/**
 * The overlays this account still has to see.
 *
 * A failed read is none: a hint is never worth breaking the page over.
 */
export async function unseenTutorials(userId: string): Promise<TutorialId[]> {
  if (tutorialAlwaysPresent()) return [...TUTORIAL_IDS];

  try {
    const prefs = await readPrefs(userId);
    return TUTORIAL_IDS.filter((id) => typeof prefs[TUTORIAL_PREFS[id]] !== "string");
  } catch {
    return [];
  }
}

/** Whether this account still has the overlay to see. */
export async function shouldShowTutorial(
  userId: string,
  tutorial: TutorialId,
): Promise<boolean> {
  return (await unseenTutorials(userId)).includes(tutorial);
}

export async function markTutorialSeen(
  userId: string,
  tutorial: TutorialId,
): Promise<void> {
  await markTutorialsSeen(userId, [tutorial]);
}

/**
 * Stamps several overlays in one write — the overlay's "Don't show tips again"
 * passes all of them.
 *
 * A stamp already there keeps its own date: it records when that overlay was
 * first closed, and hiding the rest later says nothing new about it.
 */
export async function markTutorialsSeen(
  userId: string,
  tutorials: readonly TutorialId[],
): Promise<void> {
  const prefs: Record<string, unknown> = await admin.users.getPrefs({ userId });
  const now = new Date().toISOString();
  const stamps: Record<string, string> = {};

  for (const tutorial of tutorials) {
    const key = TUTORIAL_PREFS[tutorial];
    if (typeof prefs[key] !== "string") stamps[key] = now;
  }

  await admin.users.updatePrefs({ userId, prefs: { ...prefs, ...stamps } });
}

/**
 * `TUTORIAL_ALWAYS_PRESENT`: draw every overlay on every load, dismissed or
 * not. Read at call time so tests can stub it per case.
 *
 * Unlike `DISABLE_ALL_PLAN` it is not switched off in a production build — it
 * bypasses nothing, and the overlay it forces can always be closed.
 */
export function tutorialAlwaysPresent(): boolean {
  const raw = process.env.TUTORIAL_ALWAYS_PRESENT;
  return !!raw && /^(1|true|yes)$/i.test(raw.trim());
}
