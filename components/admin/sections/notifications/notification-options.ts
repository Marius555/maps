import type { SelectOption } from "@/components/ui/select-control";
import { NOTIFICATION_KIND_STYLE } from "@/components/notifications/notification-kind";
import { NOTIFICATION_KINDS } from "@/lib/notifications/types";
import type { AdminNotificationForm } from "@/lib/validation/notification.schema";

/** The compose form's choices, and the names the Sent table uses for the same values. */

export const KIND_OPTIONS: SelectOption[] = NOTIFICATION_KINDS.map((kind) => ({
  id: kind,
  label: NOTIFICATION_KIND_STYLE[kind].label,
}));

export const AUDIENCE_OPTIONS: SelectOption[] = [
  { id: "all", label: "Everyone" },
  { id: "plan", label: "Plans" },
  { id: "user", label: "One account" },
];

export const PLAN_NAMES: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro" };

export const EMPTY_NOTIFICATION: AdminNotificationForm = {
  title: "",
  body: "",
  kind: "info",
  audience: "all",
  audienceEmail: "",
  audiencePlans: [],
  linkUrl: "",
  linkLabel: "",
  publishedAt: "",
  expiresAt: "",
};
