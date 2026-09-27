import { Card } from "@heroui/react";
import type { ReactNode } from "react";

/**
 * A titled card — every block on the Analytics page below the headline row.
 *
 * The title says what the block answers and the hint, when there is one, says
 * why it matters; `action` sits at the header's right edge for a control that
 * belongs to this block alone (a series switch, a layer switch).
 *
 * No warning tone any more. The "Opened, then nothing" card used to carry a
 * coloured rule down its left edge; it is a table tab now, and its count chip
 * in the tab strip says the same thing without decorating a card.
 */
export function SectionCard({
  title,
  hint,
  action,
  className = "",
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`min-w-0 gap-4 p-4 sm:p-5 ${className}`}>
      {/* Wraps rather than squeezes: on a phone a four-button switch drops
          under the title instead of pushing it into two-letter lines. */}
      <Card.Header className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Card.Title className="text-base font-semibold">{title}</Card.Title>
          {hint ? (
            <Card.Description className="text-xs text-pretty">{hint}</Card.Description>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </Card.Header>

      <Card.Content className="min-w-0 gap-0">{children}</Card.Content>
    </Card>
  );
}
