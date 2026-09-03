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
  toolbar,
  footer,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  description?: string;
  /** Sits opposite the title — for a secondary control the section owns. */
  action?: React.ReactNode;
  /**
   * A full-width row under the title and still above the rule, for a control
   * that governs the whole body rather than sitting beside the heading — the
   * card designer's Elements/Modify strip. Inside the header block, so it is
   * part of the chrome; a body that scrolls would carry it away.
   */
  toolbar?: React.ReactNode;
  /** Right-aligned action row below a rule. Omit when there's nothing to submit. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /**
   * Appended to the body's own classes, for a panel whose body has to do
   * something structural — the card designer's sidebar is a fixed-height column
   * whose contents scroll, which needs `flex min-h-0 flex-1 flex-col` on this
   * box specifically. Appended rather than replacing, so the padding and rhythm
   * every other panel relies on are still there.
   */
  bodyClassName?: string;
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
          {/* `pb-4` and no `pt`: the header's own `py-4` is already the space
              above this, so a padding of its own would double it. */}
          {toolbar ? (
            <div className="shrink-0 px-5 pb-4 sm:px-6">{toolbar}</div>
          ) : null}
          <Separator />
        </>
      ) : null}

      {children ? (
        <div className={`space-y-4 px-5 py-5 sm:px-6 ${bodyClassName}`}>
          {children}
        </div>
      ) : null}

      {footer ? (
        <>
          {/* Only when there's a body to separate from — a header immediately
              followed by a footer would draw two rules against each other. */}
          {children ? <Separator /> : null}
          {/* `shrink-0` because a panel whose body is a flex-1 scroller (the
              card designer's sidebar) would otherwise let this row be squeezed
              by the content above it — and this row is where Save is. */}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 px-5 py-4 sm:px-6">
            {footer}
          </div>
        </>
      ) : null}
    </section>
  );
}
