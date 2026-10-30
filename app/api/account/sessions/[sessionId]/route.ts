import { noContent } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";
import { revokeAccountSession } from "@/lib/auth/sessions";

type Params = { sessionId: string };

/**
 * Signs one other device out. Appwrite scopes the id to this account itself.
 * Open to an unconfirmed account for the reason `../route.ts` gives.
 */
export const DELETE = withPersonalAuth<Params>(
  async ({ params }) => {
    await revokeAccountSession(params.sessionId);

    return noContent();
  },
  { allowUnverified: true },
);
