/**
 * A numbered run of instructions.
 *
 * A real `<ol>`, so the count is the list's own and a screen reader announces
 * "3 of 7" rather than reading a number somebody typed into the text. The
 * markers are drawn by a counter rather than `list-decimal` because they are
 * set in a ringed circle, which the default marker box cannot hold. A hairline
 * joins each marker to the next, so the run reads as one sequence; the last
 * step has none.
 */
export function DocsSteps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="space-y-5 [counter-reset:docs-step]">{children}</ol>
  );
}

export function DocsStep({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative pl-10 [counter-increment:docs-step] after:absolute after:top-8 after:-bottom-4 after:left-3 after:w-px after:bg-border last:after:hidden">
      <span
        aria-hidden="true"
        className="absolute top-0.5 left-0 grid size-6 place-items-center rounded-full border border-border bg-surface text-xs font-medium tabular-nums text-foreground before:content-[counter(docs-step)]"
      />

      <h3 className="pb-1 text-[0.9375rem] font-medium text-foreground">{title}</h3>

      <div className="space-y-2">{children}</div>
    </li>
  );
}
