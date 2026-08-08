import { Separator } from "@heroui/react";

/**
 * A titled panel for a group of controls.
 *
 * This is the answer to forms floating loose on the page background. A form needs
 * a visible edge and a predictable rhythm: header, rule, fields at one spacing,
 * actions in a footer that is always in the same place. Settings, publish and
 * each import step are all built from this.
 *
 * Elevation is a lightness step against the canvas plus a hairline — not a heavy
 * shadow — which is how the rest of the surface system works.
 */
export function SectionPanel({
  title,
  description,
  action,
  footer,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  /** Sits opposite the title — for a secondary control the section owns. */
  action?: React.ReactNode;
  /** Right-aligned action row below a rule. Omit when there's nothing to submit. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-surface ${className}`}
    >
      {title ? (
        <>
          <header className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
            <div className="min-w-0 space-y-1">
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              {description ? (
                <p className="text-pretty text-xs text-muted">{description}</p>
              ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </header>
          <Separator />
        </>
      ) : null}

      {children ? (
        <div className="space-y-4 px-5 py-5 sm:px-6">{children}</div>
      ) : null}

      {footer ? (
        <>
          {/* Only when there's a body to separate from — a header immediately
              followed by a footer would draw two rules against each other. */}
          {children ? <Separator /> : null}
          <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 sm:px-6">
            {footer}
          </div>
        </>
      ) : null}
    </section>
  );
}
