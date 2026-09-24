import { ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { revokeOtherSessions } from "@/lib/auth/sessions";

/**
 * "Log out of all other devices". This one stays signed in.
 *
 * `allowUnverified`, like account deletion: ending a session somebody else is
 * using is a defence, not a change to anything the account owns, and it should
 * not wait on a confirmation link.
 */
export const DELETE = withAuth(async () => ok({ signedOut: await revokeOtherSessions() }), {
  allowUnverified: true,
});
