import { fail, noContent } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { markTutorialSeen } from "@/lib/auth/tutorial";
import { isTutorialId } from "@/lib/onboarding/tutorials";

type Params = { id: string };

/**
 * One onboarding overlay was closed. See `lib/auth/tutorial.ts`.
 *
 * Open to an unconfirmed account: closing a hint is not the kind of write the
 * email gate freezes, and refusing it would bring the overlay back on every load.
 */
export const POST = withAuth<Params>(
  async ({ user, params }) => {
    if (!isTutorialId(params.id)) return fail("not_found", "No such tutorial.", 404);

    await markTutorialSeen(user.id, params.id);
    return noContent();
  },
  { allowUnverified: true },
);
