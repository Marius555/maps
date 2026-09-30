"use client";

import { useState } from "react";
import { useWatch, type Control } from "react-hook-form";

import { NotificationItem } from "@/components/notifications/notification-item";
import { isSafeNotificationLink, type AdminNotificationForm } from "@/lib/validation/notification.schema";

/**
 * The message as an owner will see it — the customer page's own row, fed the
 * form's values, so the preview cannot drift from the real thing. A link shows
 * only once it would be drawn for real: safe, and with a label.
 */
export function NotificationPreview({ control }: { control: Control<AdminNotificationForm> }) {
  const [now] = useState(() => Date.now());
  const [title, body, kind, linkUrl, linkLabel, publishedAt] = useWatch({
    control,
    name: ["title", "body", "kind", "linkUrl", "linkLabel", "publishedAt"],
  });

  const sendAt = publishedAt ? new Date(publishedAt) : null;
  const showsLink = Boolean(linkUrl && linkLabel && isSafeNotificationLink(linkUrl.trim()));

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted">Preview</p>
      <NotificationItem
        now={now}
        isNew
        notification={{
          id: "preview",
          title: title.trim() || "Your title",
          body: body.trim() || "Your message, as the owner will read it.",
          kind,
          linkUrl: showsLink ? linkUrl.trim() : null,
          linkLabel: showsLink ? linkLabel.trim() : null,
          publishedAt:
            sendAt && !Number.isNaN(sendAt.getTime())
              ? sendAt.toISOString()
              : new Date(now).toISOString(),
          expiresAt: null,
        }}
      />
    </div>
  );
}
