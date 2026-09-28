import "server-only";

import { admin } from "@/lib/appwrite/admin";
import type { AuthUser } from "@/lib/auth/types";
import { BRAND } from "@/lib/brand";
import { sendEmail } from "@/lib/email/resend";
import { supportRequestMessage } from "@/lib/email/templates/support-request";
import { RepositoryError } from "@/lib/repositories/errors";
import { assertPlanFeature, getUserPlan } from "@/lib/repositories/plan-limits";
import { subjectLabel, type SupportRequestInput } from "@/lib/validation/support.schema";
import { isTooSoon } from "./throttle";

/**
 * A bug report or support request from the account menu, mailed to the support
 * address with the person's chosen reply address on `replyTo`.
 *
 * **Contact support is a paid feature, refused here as well as greyed in the
 * menu** (CLAUDE.md §6: limits live on the server). A bug report is on every
 * plan — it is us asking to be told what is broken.
 *
 * **Throttled to one a minute per account, across both kinds**, on the
 * account's prefs rather than in memory: Appwrite Sites runs more than one
 * instance, and a limit each of them keeps separately is not one. Stamped only
 * after the mail went, so a failed send never costs the person their next try.
 * Prefs are merged, never written over — `updatePrefs` replaces the whole
 * object, and the tutorial stamps and `deletionStartedAt` live there too.
 *
 * **Unlike every other sender, a failed send fails the request.** Elsewhere mail
 * is the tail of something that already succeeded; here the mail *is* the
 * action, and a 204 for a message nobody received would be a lie.
 */
const PREF = "supportRequestedAt";

export async function sendSupportRequest({
  user,
  input,
  userAgent,
}: {
  user: AuthUser;
  input: SupportRequestInput;
  userAgent?: string;
}): Promise<void> {
  const to = BRAND.contact.supportEmail;
  if (!to) {
    throw new RepositoryError(
      "internal_error",
      "Messages to support aren't set up yet. Try again later.",
      503,
    );
  }

  if (input.kind === "support") await assertPlanFeature(user.id, "support");

  const prefs: Record<string, unknown> = await admin.users.getPrefs({
    userId: user.id,
  });
  const last = prefs[PREF];

  if (isTooSoon(typeof last === "string" ? last : undefined, new Date())) {
    throw new RepositoryError(
      "rate_limited",
      "You sent a message a moment ago. Wait a minute and try again.",
      429,
    );
  }

  const sentAt = new Date().toISOString();
  const { sent } = await sendEmail({
    to,
    replyTo: input.replyTo,
    ...supportRequestMessage({
      kind: input.kind,
      label: subjectLabel(input),
      message: input.message,
      replyTo: input.replyTo,
      page: input.page,
      viewport: input.viewport,
      userAgent: userAgent?.slice(0, 300),
      email: user.email,
      name: user.name,
      userId: user.id,
      plan: await getUserPlan(user.id),
      sentAt,
    }),
  });

  if (!sent) {
    throw new RepositoryError(
      "internal_error",
      `Couldn't send your message. Email us at ${to} instead.`,
      503,
    );
  }

  await admin.users.updatePrefs({
    userId: user.id,
    prefs: { ...prefs, [PREF]: sentAt },
  });
}
