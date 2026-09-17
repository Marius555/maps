import { Info, TriangleAlert } from "lucide-react";

/**
 * An aside that must not be skimmed past.
 *
 * **Amber comes from `--warning-ink`, never `--warning`.** The latter is a fill
 * token with a `--warning-foreground` partner and is built to be a background;
 * used as a text colour it sits near 2:1 against the page, well under AA. Same
 * rule `plan-limit-note.tsx` and `confidence-mark.tsx` follow.
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
      className={`flex items-start gap-2.5 rounded-xl border border-border bg-surface p-4 text-sm/6 ${
        isWarning ? "text-warning-ink" : "text-foreground"
      }`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />

      <div className="min-w-0 [&_p+p]:pt-2">
        <span className="sr-only">{isWarning ? "Warning: " : "Note: "}</span>
        {children}
      </div>
    </div>
  );
}
