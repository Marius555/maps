/**
 * A setting as a sentence and a control: what it is on the left, the thing you
 * press on the right. Below `sm` the two stack, control underneath, because a
 * phone has no room for both side by side and a squeezed label wraps into a
 * column one word wide.
 *
 * Rows go inside `SettingsRows`, which draws the rules between them.
 */
export function SettingsRow({
  label,
  description,
  children,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description ? (
          <div className="mt-0.5 text-pretty text-sm text-muted">{description}</div>
        ) : null}
      </div>

      {children ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

export function SettingsRows({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-separator">{children}</div>;
}
