import { noContent } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { markTutorialsSeen } from "@/lib/auth/tutorial";
import { TUTORIAL_IDS } from "@/lib/onboarding/tutorials";

/**
 * Every onboarding overlay at once: the overlay's "Don't show tips again". See
 * `lib/auth/tutorial.ts`; `TUTORIAL_ALWAYS_PRESENT` still draws them all on the
 * next load, stamps or not.
 *
 * Open to an unconfirmed account for the per-overlay route's reason.
 */
export const POST = withAuth(
  async ({ user }) => {
    await markTutorialsSeen(user.id, TUTORIAL_IDS);
    return noContent();
  },
  { allowUnverified: true },
);
