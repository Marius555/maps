import "server-only";

import { admin } from "@/lib/appwrite/admin";

/**
 * How often one account may be mailed a confirmation link — counted on the
 * account, so it holds where `lib/rate-limit/limiter.ts` does not.
 *
 * The in-memory counters answer the button with a 429 and a countdown, and that
 * is enough while one process is answering. They are forgotten by a restart, a
 * dev server's reload and every second Appwrite Sites instance, which made
 * "Send a new link" a button that could be pressed into somebody's inbox. This
 * is the half that survives all three: one link a minute, five a day, stamped on
 * the account's prefs **only after a send went**, so a Resend failure never costs
 * the person their next try (the precedent is `lib/support/support-request.ts`).
 *
 * Prefs are merged, never written over — `updatePrefs` replaces the whole object,
 * and the tutorial stamps, `deletionStartedAt` and the notification marker live
 * there too.
 */
const PREF = "verifyEmailSentAt";

const MIN_GAP_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PER_DAY = 5;

/** The sends on record, newest last, as epoch milliseconds. Anything unreadable is ignored. */
function sentTimes(prefs: Record<string, unknown> | undefined): number[] {
  const raw = prefs?.[PREF];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((value) => (typeof value === "string" ? Date.parse(value) : Number.NaN))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);
}

/** May another confirmation link go to this account now? */
export function mayResendVerification(
  prefs: Record<string, unknown> | undefined,
  now: Date,
): boolean {
  const at = now.getTime();
  const times = sentTimes(prefs);
  const last = times.at(-1);

  if (last !== undefined && at - last < MIN_GAP_MS) return false;

  return times.filter((time) => at - time < DAY_MS).length < PER_DAY;
}

/** The pref's next value: this send appended, only the last day's kept, at most five. */
export function withSendStamped(
  prefs: Record<string, unknown> | undefined,
  now: Date,
): string[] {
  const at = now.getTime();

  return [...sentTimes(prefs).filter((time) => at - time < DAY_MS), at]
    .slice(-PER_DAY)
    .map((time) => new Date(time).toISOString());
}

/** Record a confirmation link that went out. Re-reads prefs so the merge is fresh. */
export async function stampVerificationSent(userId: string): Promise<void> {
  const prefs: Record<string, unknown> = await admin.users.getPrefs({ userId });

  await admin.users.updatePrefs({
    userId,
    prefs: { ...prefs, [PREF]: withSendStamped(prefs, new Date()) },
  });
}
