import { noContent } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { markNotificationsSeen } from "@/lib/notifications/seen";

/**
 * The Notifications page was opened: everything on it is no longer new.
 *
 * Open to an unconfirmed account, for the tutorial route's reason: acknowledging
 * a message is not the kind of write the email gate freezes, and refusing it
 * would leave the sidebar's count up for good.
 */
export const POST = withAuth(
  async ({ user }) => {
    await markNotificationsSeen(user.id);
    return noContent();
  },
  { allowUnverified: true },
);
