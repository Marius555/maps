import { noContent } from "@/lib/api/responses";
import { withAdmin } from "@/lib/api/route";
import { deleteNotification } from "@/lib/repositories/notifications.repository";

/** Withdraw a notification: every owner it was addressed to stops seeing it. */
export const DELETE = withAdmin<{ id: string }>(async (_request, { id }) => {
  await deleteNotification(id);

  return noContent();
});
