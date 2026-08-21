import type { RowIssue } from "@/lib/import/issues";

/**
 * What is wrong with a row, said beside the thing that fixes it.
 *
 * One list component rather than a message slot per field, because the messages
 * differ only in severity and the row decides which subset to show where — the
 * name's issues under the name box, the address and coordinate ones under the
 * address box.
 *
 * Warnings are muted text with an amber dot, not amber text. `--warning` is a
 * fill token whose foreground partner is near-black, so as a text colour it
 * disappears in dark mode — the same reason `place-status-flag.tsx` draws its
 * ring with the token and never writes in it.
 */
export function RowIssues({
  issues,
  className = "",
}: {
  issues: RowIssue[];
  className?: string;
}) {
  if (issues.length === 0) return null;

  return (
    <ul className={`space-y-1 ${className}`}>
      {issues.map((issue, index) => (
        <li
          key={`${issue.field}-${index}`}
          className={`flex items-start gap-1.5 text-xs ${
            issue.severity === "error" ? "text-danger" : "text-muted"
          }`}
        >
          <span
            aria-hidden
            className={`mt-1 size-1.5 shrink-0 rounded-full ${
              issue.severity === "error"
                ? "bg-danger"
                : "bg-[var(--warning)]"
            }`}
          />
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}
