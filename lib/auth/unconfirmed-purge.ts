import "server-only";

import { runDeletionStep } from "@/lib/account-deletion/step";
import { deletionStoreFor } from "@/lib/account-deletion/store";
import { listOwnedMapIds } from "@/lib/repositories/account-deletion.repository";
import { ownerContext, ownWorkspace } from "@/lib/repositories/context";
import { getSubscription } from "@/lib/repositories/subscriptions.repository";
import { listUnconfirmedUsers } from "./account";
import { emailGateActive, readsAsVerified } from "./email-gate";
import {
  runUnconfirmedPurgeStep,
  type UnconfirmedPurgeStep,
  type UnconfirmedPurgeStore,
} from "./unconfirmed-purge-step";

/**
 * The daily deletion of accounts left unconfirmed past their grace period —
 * the rules are in `unconfirmed-purge-step.ts`; this is the gate and the real
 * store. Driven by `/api/cron/unconfirmed-accounts`, which the scheduled function
 * walks once a day (functions/sheet-sync).
 */

/**
 * More than any account that owns nothing will ever need — such an account is
 * one step (`runDeletionStep`), its rows and then its login.
 */
const MAX_DELETION_STEPS = 5;

const store: UnconfirmedPurgeStore = {
  listUnconfirmed: listUnconfirmedUsers,

  async mustKeep(userId) {
    if ((await listOwnedMapIds(ownerContext(userId))).length > 0) return true;
    return (await getSubscription(ownWorkspace(userId))) !== null;
  },

  async deleteAccount(userId) {
    const deletion = deletionStoreFor(ownerContext(userId));

    for (let step = 0; step < MAX_DELETION_STEPS; step += 1) {
      if ((await runDeletionStep(deletion)).done) return;
    }

    throw new Error(`Deleting unconfirmed account ${userId} did not finish.`);
  },
};

export async function purgeUnconfirmedAccounts(input: {
  cursor: string | null;
  deadline: number;
  now: Date;
}): Promise<UnconfirmedPurgeStep> {
  // **Never while the gate is off.** With no Resend key an unconfirmed account
  // is a fully working one — nobody could ever confirm it — and with the
  // development bypass every account reads as confirmed. Deleting either would
  // be deleting somebody's work on a timer.
  if (!emailGateActive() || readsAsVerified(false)) {
    return { cursor: null, more: false, deleted: 0, kept: 0 };
  }

  return runUnconfirmedPurgeStep(store, input);
}
