/**
 * One titled block of a settings page.
 *
 * Flat, the way claude.ai's settings are: a heading, the rows, and a hairline
 * before the next section, rather than one bordered card per group. A page of
 * four stacked cards reads as four forms; one column with rules between its
 * parts reads as one page about one person.
 *
 * `action` sits opposite the heading, for a control that belongs to the whole
 * section rather than to one row in it. Below `sm` it drops under the heading
 * instead, because a toggle beside a two-line description squeezes both.
 */
export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-separator py-8 first:pt-0 last:border-b-0 last:pb-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-pretty text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
