import { created, fail } from "@/lib/api/responses";
import { parseBody, withAdmin } from "@/lib/api/route";
import { findUserIdByEmail } from "@/lib/repositories/admin/users";
import { createNotification } from "@/lib/repositories/notifications.repository";
import {
  adminNotificationFormSchema,
  notificationInputSchema,
  toNotificationInput,
} from "@/lib/validation/notification.schema";

/**
 * Send a notification from the operator console. docs/notes/notifications.md.
 *
 * Parsed twice: once as the console's form, then — recipient resolved from its
 * email — as `notificationInputSchema`, so the link and audience rules that
 * guard every owner's page are the same ones the repository was written for.
 */
export const POST = withAdmin(async (request) => {
  const form = await parseBody(request, adminNotificationFormSchema);

  let audienceUserId: string | undefined;
  if (form.audience === "user") {
    audienceUserId = (await findUserIdByEmail(form.audienceEmail)) ?? undefined;

    if (!audienceUserId) {
      return fail("validation_failed", "Check the highlighted fields and try again.", 422, {
        audienceEmail: ["No account uses that address."],
      });
    }
  }

  const input = await notificationInputSchema.parseAsync(toNotificationInput(form, audienceUserId));

  return created(await createNotification(input));
});
