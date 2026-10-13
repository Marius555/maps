import { format, formatDistanceStrict } from "date-fns";

/**
 * When a notification was published, relative, with the exact time on hover.
 *
 * `suppressHydrationWarning` because the server's render and the browser's can
 * straddle a minute boundary; the mismatch is one word and not worth a flash.
 */
export function NotificationTime({
  publishedAt,
  now,
  className = "",
}: {
  publishedAt: string;
  /** One clock for the whole list, so neighbouring rows cannot disagree. */
  now: number;
  className?: string;
}) {
  const published = new Date(publishedAt);

  return (
    <time
      dateTime={publishedAt}
      title={format(published, "d MMM yyyy, HH:mm")}
      suppressHydrationWarning
      className={`shrink-0 text-xs tabular-nums text-muted ${className}`}
    >
      {now - published.getTime() < 60_000
        ? "Just now"
        : formatDistanceStrict(published, now, { addSuffix: true })}
    </time>
  );
}
