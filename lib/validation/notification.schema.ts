import { z } from "zod";

import {
  NOTIFICATION_AUDIENCES,
  NOTIFICATION_KINDS,
} from "@/lib/notifications/types";

/**
 * What the operator console may write as a notification — the rules
 * `createNotification` was written against. The console's form speaks
 * `adminNotificationFormSchema` below; its route turns that into this.
 *
 * **The link is the one field that can hurt.** It becomes an `href` on every
 * addressed account's page, so it is held to `https://` or an in-app path:
 * `javascript:` and `data:` URLs are refused here, and a protocol-relative
 * `//host` is refused as well because it reads as a path and leaves the site.
 */
export const PLAN_VALUES = ["free", "starter", "pro"] as const;

export function isSafeNotificationLink(url: string): boolean {
  if (url.startsWith("/")) return !url.startsWith("//") && !url.startsWith("/\\");

  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export const notificationInputSchema = z
  .object({
    title: z.string().trim().min(1, "Add a title.").max(120, "Keep the title under 120 characters."),
    body: z.string().trim().min(1, "Add a message.").max(5000, "Keep the message under 5,000 characters."),
    kind: z.enum(NOTIFICATION_KINDS).default("info"),
    audience: z.enum(NOTIFICATION_AUDIENCES),
    audienceUserId: z.string().trim().max(36).optional(),
    audiencePlans: z.array(z.enum(PLAN_VALUES)).max(PLAN_VALUES.length).optional(),
    linkUrl: z
      .string()
      .trim()
      .max(2048)
      .refine(isSafeNotificationLink, "Use an https:// address or a path starting with /.")
      .optional(),
    linkLabel: z.string().trim().max(40, "Keep the button label under 40 characters.").optional(),
    publishedAt: z.iso.datetime({ offset: true }).optional(),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.audience === "user" && !input.audienceUserId) {
      ctx.addIssue({ code: "custom", path: ["audienceUserId"], message: "Choose the account to send this to." });
    }

    if (input.audience === "plan" && !input.audiencePlans?.length) {
      ctx.addIssue({ code: "custom", path: ["audiencePlans"], message: "Choose at least one plan." });
    }

    if (input.linkUrl && !input.linkLabel) {
      ctx.addIssue({ code: "custom", path: ["linkLabel"], message: "Name the button the link sits on." });
    }

    if (input.linkLabel && !input.linkUrl) {
      ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Add the address the button opens." });
    }

    const published = input.publishedAt ? Date.parse(input.publishedAt) : Date.now();
    if (input.expiresAt && Date.parse(input.expiresAt) <= published) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Set the expiry after the publish time." });
    }
  });

export type NotificationInput = z.output<typeof notificationInputSchema>;

/**
 * The console's compose form: the same message, but one account is named by its
 * email rather than an Appwrite id, and the two dates are optional strings the
 * form may leave empty. `POST /api/admin/notifications` resolves the address and
 * then parses the result with `notificationInputSchema`, so the link and
 * audience rules above are the ones that decide.
 */
const optionalDate = z
  .string()
  .trim()
  .max(40)
  .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), "Enter a date and time.");

export const adminNotificationFormSchema = z
  .object({
    title: z.string().trim().min(1, "Add a title.").max(120, "Keep the title under 120 characters."),
    body: z.string().trim().min(1, "Add a message.").max(5000, "Keep the message under 5,000 characters."),
    kind: z.enum(NOTIFICATION_KINDS),
    audience: z.enum(NOTIFICATION_AUDIENCES),
    audienceEmail: z.string().trim().max(320),
    audiencePlans: z.array(z.enum(PLAN_VALUES)).max(PLAN_VALUES.length),
    linkUrl: z
      .string()
      .trim()
      .max(2048)
      .refine((url) => url === "" || isSafeNotificationLink(url), "Use an https:// address or a path starting with /."),
    linkLabel: z.string().trim().max(40, "Keep the button label under 40 characters."),
    // Either a wall-clock date-time (the form's DatePicker) or ISO (the request body): the
    // form converts on submit, and the route's second parse holds it to ISO.
    publishedAt: optionalDate,
    expiresAt: optionalDate,
  })
  .superRefine((input, ctx) => {
    if (input.audience === "user" && !z.email().safeParse(input.audienceEmail).success) {
      ctx.addIssue({ code: "custom", path: ["audienceEmail"], message: "Enter the account's email address." });
    }

    if (input.audience === "plan" && input.audiencePlans.length === 0) {
      ctx.addIssue({ code: "custom", path: ["audiencePlans"], message: "Choose at least one plan." });
    }

    if (input.linkUrl && !input.linkLabel) {
      ctx.addIssue({ code: "custom", path: ["linkLabel"], message: "Name the button the link sits on." });
    }

    if (input.linkLabel && !input.linkUrl) {
      ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Add the address the button opens." });
    }

    const published = input.publishedAt ? Date.parse(input.publishedAt) : Date.now();
    if (input.expiresAt && Date.parse(input.expiresAt) <= published) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Set the expiry after the send time." });
    }
  });

export type AdminNotificationForm = z.infer<typeof adminNotificationFormSchema>;

/** The form's values as `notificationInputSchema` expects them, recipient resolved. */
export function toNotificationInput(
  form: AdminNotificationForm,
  audienceUserId: string | undefined,
): z.input<typeof notificationInputSchema> {
  return {
    title: form.title,
    body: form.body,
    kind: form.kind,
    audience: form.audience,
    audienceUserId: form.audience === "user" ? audienceUserId : undefined,
    audiencePlans: form.audience === "plan" ? form.audiencePlans : undefined,
    linkUrl: form.linkUrl || undefined,
    linkLabel: form.linkUrl ? form.linkLabel || undefined : undefined,
    publishedAt: form.publishedAt || undefined,
    expiresAt: form.expiresAt || undefined,
  };
}
