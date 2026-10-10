import { Info, TriangleAlert } from "lucide-react";

/**
 * An aside that must not be skimmed past.
 *
 * **Tinted, so it reads as an aside at a glance.** It used to be the page's own
 * surface with a hairline border, which on a long guide looked like one more
 * paragraph. A note sits on `--accent-soft` with an accent icon, a warning on a
 * wash of `--warning` with an amber icon.
 *
 * **The text stays `text-foreground` in both.** Amber comes from `--warning-ink`,
 * and only on the icon: `--warning` is a fill token, near 2:1 as text, and even
 * the ink is a colour for a mark or a short label rather than a paragraph
 * somebody has to read. Same rule `plan-limit-note.tsx` and
 * `confidence-mark.tsx` follow.
 *
 * The icon is decorative and the tone is repeated in `sr-only` text, because
 * colour plus an icon shape is not a signal everybody receives.
 */
export function DocsCallout({
  tone = "note",
  children,
}: {
  tone?: "note" | "warning";
  children: React.ReactNode;
}) {
  const isWarning = tone === "warning";
  const Icon = isWarning ? TriangleAlert : Info;

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border p-4 text-sm/6 text-foreground ${
        isWarning ? "border-warning/45 bg-warning/12" : "border-accent/25 bg-accent-soft"
      }`}
    >
      <Icon
        aria-hidden="true"
        className={`mt-1 size-4 shrink-0 ${isWarning ? "text-warning-ink" : "text-accent"}`}
      />

      <div className="min-w-0 [&_p+p]:pt-2">
        <span className="sr-only">{isWarning ? "Warning: " : "Note: "}</span>
        {children}
      </div>
    </div>
  );
}
