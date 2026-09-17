/**
 * A numbered run of instructions.
 *
 * A real `<ol>`, so the count is the list's own and a screen reader announces
 * "3 of 7" rather than reading a number somebody typed into the text. The
 * markers are drawn by a counter rather than `list-decimal` because they are
 * set in a filled circle, which the default marker box cannot hold.
 */
export function DocsSteps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="space-y-4 [counter-reset:docs-step]">{children}</ol>
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
    <li className="relative pl-9 [counter-increment:docs-step]">
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 grid size-6 place-items-center rounded-full bg-default text-xs font-medium tabular-nums text-foreground before:content-[counter(docs-step)]"
      />

      <h3 className="pb-1 text-sm font-medium text-foreground">{title}</h3>

      <div className="space-y-2">{children}</div>
    </li>
  );
}
