/**
 * A titled part of a guide, addressable on its own.
 *
 * The `id` is the point: a support reply is nearly always about one step, and
 * `/docs/importing-locations#columns` is the difference between sending someone
 * to the answer and sending them to the page that contains it. The `#` beside
 * the heading, shown on hover or focus, is how anybody else gets that link.
 *
 * The `#` sits beside the `<h2>`, not inside it, so the heading's accessible
 * name — and the title `DocsToc` reads off it — is the title alone. Its
 * `!` overrides beat the article's descendant link styles, which would
 * otherwise underline it in foreground.
 *
 * `scroll-mt-8` so a heading jumped to does not land flush against the top of
 * the viewport with its first paragraph already under the fold.
 */
export function DocsSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-8">
      <div className="group/heading flex items-baseline gap-2 pb-4">
        <h2
          id={`${id}-heading`}
          className="font-display text-xl font-semibold tracking-tight text-balance text-foreground"
        >
          {title}
        </h2>
        <a
          href={`#${id}`}
          aria-label={`Link to “${title}”`}
          className="text-muted! no-underline! opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover/heading:opacity-100 hover:text-foreground! focus-visible:opacity-100"
        >
          #
        </a>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}
