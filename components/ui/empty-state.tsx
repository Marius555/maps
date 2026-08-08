import type { LucideIcon } from "lucide-react";

/**
 * An empty state is an invitation to act (CLAUDE.md §8) — the primary action
 * belongs right here, not somewhere else on the page.
 *
 * No dashed border. A dashed rectangle reads as a dropzone or a build error, and
 * the app had five slightly different ones. This is the only version: a centred
 * column on a quiet surface, with the icon in a round medallion so it looks
 * placed rather than dropped in.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "md",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** `sm` for panels and sidebars, `md` for a whole page. */
  size?: "sm" | "md";
}) {
  const isSmall = size === "sm";

  return (
    <div
      className={`flex flex-col items-center rounded-xl bg-surface-secondary text-center ${
        isSmall ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14"
      }`}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className={`grid place-items-center rounded-full bg-default text-muted ${
            isSmall ? "size-9" : "size-11"
          }`}
        >
          <Icon className={isSmall ? "size-4" : "size-5"} />
        </span>
      ) : null}

      <h3
        className={`font-medium text-foreground ${isSmall ? "text-sm" : "text-base"}`}
      >
        {title}
      </h3>

      {description ? (
        <p className={`max-w-sm text-pretty text-muted ${isSmall ? "text-xs" : "text-sm"}`}>
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
