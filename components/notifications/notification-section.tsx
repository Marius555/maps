/**
 * One group of the list — New, or Earlier — as a single bordered panel with
 * rules between its rows, rather than a card per message.
 *
 * The heading is left out when there is only one group: a lone "Earlier" over
 * the only list on the page labels nothing.
 */
export function NotificationSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string | null;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={heading ? id : undefined} className="space-y-2">
      {heading ? (
        <h2 id={id} className="px-1 text-xs font-medium uppercase tracking-wide text-muted">
          {heading}
        </h2>
      ) : null}

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {children}
      </ul>
    </section>
  );
}
