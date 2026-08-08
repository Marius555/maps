/**
 * The one page heading.
 *
 * A single scale, deliberately modest: the sidebar and the topbar breadcrumb now
 * carry the "where am I" job, so a large title would repeat what the chrome
 * already said. Before this there were three competing scales — `text-2xl` here,
 * `text-lg` in the map layout, `text-3xl sm:text-5xl` on the landing page.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-pretty text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
