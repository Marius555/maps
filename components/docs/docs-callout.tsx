import { Info, TriangleAlert } from "lucide-react";

/**
 * An aside that must not be skimmed past.
 *
 * **A raised panel, not a tint.** It is a hairline box on a wash of `--default`,
 * the way Appwrite's docs set theirs, which reads as an aside at a glance without
 * a coloured block in the middle of the page. The tone is carried by the icon —
 * accent for a note, amber for a warning — and a warning's border takes a wash
 * of `--warning` so it still stands apart from a note.
 *
 * **The text is the guide's own prose colour.** Amber comes from `--warning-ink`,
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
      className={`flex items-start gap-3 rounded-[10px] border bg-default/40 px-4 py-3.5 text-sm/6 text-docs-prose ${
        isWarning ? "border-warning/40" : "border-border"
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
