import { format, formatDistanceStrict } from "date-fns";

import type { AppNotification } from "@/lib/notifications/types";
import { NOTIFICATION_KIND_STYLE } from "./notification-kind";
import { NotificationLink } from "./notification-link";

/**
 * One notification.
 *
 * The body is plain text with its line breaks kept — never HTML or markdown. It
 * is written by us, but it is drawn on every addressed account's page, and a
 * renderer is a second place for a mistake in the admin dashboard to become
 * somebody's broken page.
 *
 * "New" is a word as well as a dot, so it is not told in colour alone.
 */
export function NotificationItem({
  notification,
  isNew,
  now,
}: {
  notification: AppNotification;
  isNew: boolean;
  /** One clock for the whole list, so neighbouring rows cannot disagree. */
  now: number;
}) {
  const { title, body, kind, linkUrl, linkLabel, publishedAt } = notification;
  const style = NOTIFICATION_KIND_STYLE[kind];
  const Icon = style.icon;
  const published = new Date(publishedAt);

  return (
    <article
      aria-labelledby={`notification-${notification.id}`}
      className={`flex gap-3 rounded-xl border p-4 sm:gap-4 sm:p-5 ${
        isNew ? "border-accent/40 bg-surface" : "border-border bg-surface"
      }`}
    >
      <span
        role="img"
        aria-label={style.label}
        className={`grid size-9 shrink-0 place-items-center rounded-full ${style.className}`}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2
            id={`notification-${notification.id}`}
            className="min-w-0 break-words text-sm font-semibold text-foreground"
          >
            {title}
          </h2>

          {isNew ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              New
            </span>
          ) : null}

          {/* Relative, so the server's render and the browser's can straddle a
              minute boundary; the mismatch is one word and not worth a flash. */}
          <time
            dateTime={publishedAt}
            title={format(published, "d MMM yyyy, HH:mm")}
            suppressHydrationWarning
            className="ml-auto shrink-0 text-xs text-muted"
          >
            {now - published.getTime() < 60_000
              ? "Just now"
              : formatDistanceStrict(published, now, { addSuffix: true })}
          </time>
        </header>

        <p className="whitespace-pre-line break-words text-sm text-muted">{body}</p>

        {linkUrl && linkLabel ? (
          <div className="pt-1">
            <NotificationLink href={linkUrl} label={linkLabel} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
