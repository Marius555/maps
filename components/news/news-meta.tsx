import { NEWS_CATEGORY_LABELS, type NewsCategory } from "@/lib/news/types";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * `2026-10-04T…` → `Oct 4, 2026`, in UTC and written out by hand.
 *
 * Not `Intl` or a locale: the server has none, and a date rendered by the server
 * and again by a client would print two different strings (CLAUDE.md,
 * "Invariants").
 */
export function formatNewsDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return `${MONTHS[date.getUTCMonth()]} ${String(date.getUTCDate())}, ${String(date.getUTCFullYear())}`;
}

export function NewsDate({ iso, className = "" }: { iso: string | null; className?: string }) {
  const text = formatNewsDate(iso);

  return text && iso ? (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  ) : null;
}

/** "Category  Date" — the line above a post's title wherever it is listed. */
export function NewsMeta({
  category,
  publishedAt,
  className = "",
}: {
  category: NewsCategory;
  publishedAt: string | null;
  className?: string;
}) {
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2.5 text-sm ${className}`}>
      <span className="font-medium text-foreground">{NEWS_CATEGORY_LABELS[category]}</span>
      <NewsDate iso={publishedAt} className="text-muted" />
    </p>
  );
}
