/**
 * A titled part of a guide, addressable on its own.
 *
 * The `id` is the point: a support reply is nearly always about one step, and
 * `/docs/importing-locations#columns` is the difference between sending someone
 * to the answer and sending them to the page that contains it.
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
      <h2
        id={`${id}-heading`}
        className="pb-4 text-lg font-semibold tracking-tight text-foreground"
      >
        {title}
      </h2>

      <div className="space-y-4">{children}</div>
    </section>
  );
}
