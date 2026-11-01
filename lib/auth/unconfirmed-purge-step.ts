/**
 * One step of deleting accounts that never confirmed their address.
 *
 * **Why they go.** An unconfirmed account cannot write anything (the email gate,
 * `lib/auth/email-gate.ts`), so after a week it is almost always one of two
 * things: somebody who typed an address that was not theirs, or a bot that typed
 * a stranger's. From 2026-10-24 a bot made 127 of the second kind in nine days
 * (docs/notes/auth.md, "Bot signups"). Keeping them buys nothing and keeps a
 * stranger's address in our user list. The link lasts 24 hours and can be asked
 * for again, so seven days is generous to anyone real.
 *
 * **What is never deleted.** An account that owns a map or has ever had a
 * subscription row is kept and stepped over: neither can be a bot, and
 * deleting data or a payer is not something to do on a timer. The caller adds
 * one more rule — nothing runs at all while the email gate is off
 * (`unconfirmed-purge.ts`), because then unconfirmed accounts are fully usable.
 *
 * **Why the cursor only moves past kept accounts.** Deleted accounts drop out of
 * the next query by themselves, and Appwrite refuses a cursor that names a row
 * that no longer exists — so the cursor is always the last account *kept*,
 * which is still there, and everything before it has been dealt with.
 *
 * Pure orchestration over a store, like `lib/account-deletion/step.ts`, so the
 * rules are tested without Appwrite (`unconfirmed-purge-step.test.ts`).
 */

export const UNCONFIRMED_GRACE_DAYS = 7;

/** Accounts offered to one step. */
export const UNCONFIRMED_PAGE = 25;

const DAY_MS = 24 * 60 * 60_000;

export type UnconfirmedPurgeStore = {
  listUnconfirmed(input: {
    registeredBefore: string;
    cursor: string | null;
    limit: number;
  }): Promise<{ id: string; emailVerified: boolean }[]>;
  /** Whether this account has something worth keeping: a map or a subscription. */
  mustKeep(userId: string): Promise<boolean>;
  deleteAccount(userId: string): Promise<void>;
};

export type UnconfirmedPurgeStep = {
  /** Where the next step starts. Only meaningful while `more` is true. */
  cursor: string | null;
  /** Whether another step may find more to do. */
  more: boolean;
  deleted: number;
  kept: number;
};

export async function runUnconfirmedPurgeStep(
  store: UnconfirmedPurgeStore,
  input: { cursor: string | null; deadline: number; now: Date; clock?: () => number },
): Promise<UnconfirmedPurgeStep> {
  const clock = input.clock ?? Date.now;
  const registeredBefore = new Date(
    input.now.getTime() - UNCONFIRMED_GRACE_DAYS * DAY_MS,
  ).toISOString();

  const accounts = await store.listUnconfirmed({
    registeredBefore,
    cursor: input.cursor,
    limit: UNCONFIRMED_PAGE,
  });

  let cursor = input.cursor;
  let deleted = 0;
  let kept = 0;

  for (const account of accounts) {
    // Checked only after some work, so every step makes progress.
    if (deleted + kept > 0 && clock() > input.deadline) {
      return { cursor, more: true, deleted, kept };
    }

    // The query asked for unconfirmed accounts; this is the second look before
    // something irreversible.
    if (account.emailVerified || (await store.mustKeep(account.id))) {
      kept += 1;
      cursor = account.id;
      continue;
    }

    await store.deleteAccount(account.id);
    deleted += 1;
  }

  const more = accounts.length === UNCONFIRMED_PAGE;

  return { cursor: more ? cursor : null, more, deleted, kept };
}
