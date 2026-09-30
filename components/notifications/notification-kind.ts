import { CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";

import type { NotificationKind } from "@/lib/notifications/types";

/**
 * How each kind is marked: an icon in a filled medallion.
 *
 * Filled with the theme's fill token and drawn in its paired foreground, rather
 * than the icon tinted on the page — `--success` and `--warning` are fill
 * colours and land near 2:1 used as ink on a light surface (see `--warning-ink`
 * in globals.css). The pair carries its own contrast in both themes.
 */
export const NOTIFICATION_KIND_STYLE: Record<
  NotificationKind,
  { icon: LucideIcon; label: string; className: string }
> = {
  info: { icon: Info, label: "Announcement", className: "bg-accent text-accent-foreground" },
  success: { icon: CircleCheck, label: "Good news", className: "bg-success text-success-foreground" },
  warning: { icon: TriangleAlert, label: "Heads up", className: "bg-warning text-warning-foreground" },
};
