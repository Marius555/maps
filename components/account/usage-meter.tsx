import { Card, Meter } from "@heroui/react";
import type { LucideIcon } from "lucide-react";

import { formatCount } from "@/lib/format/number";

/**
 * One thing you are using, against how much of it this plan allows.
 *
 * **A `Meter`, not a progress bar, and not the hand-rolled `role="img"` bar this
 * replaces.** The old one was right to refuse `progressbar` — nothing here is in
 * progress — but it then had to describe itself in an `aria-label` on a `<div>`,
 * which means nothing on its own. A meter is *exactly* this: a measurement inside
 * a known range. React Aria gives it the role and the value, `valueLabel` gives it
 * "3 of 15" instead of a bare percentage, and HeroUI's `Meter.Fill` takes its own
 * width from the value — so the number, the bar and what a screen reader says can
 * no longer disagree with each other.
 *
 * The figure is drawn above the meter rather than in `Meter.Output`, which is what
 * HeroUI's own grid would put beside the label at `text-sm`. This is the number the
 * card exists for, and a card whose headline is set in the same size as its caption
 * is the grey page this page stopped being.
 *
 * The three bands are about what the reader should do, not about arithmetic: below
 * 75% there is nothing to think about, above 90% there is a decision coming this
 * month.
 *
 * **A full bar is red, including a Free account with its one map.** Being at the
 * ceiling is precisely what this page exists to say; softening it would leave the
 * one number that explains a refusal looking like the three that do not.
 */
export function UsageMeter({
  label,
  icon: Icon,
  used,
  limit,
  note,
}: {
  label: string;
  icon: LucideIcon;
  used: number;
  limit: number;
  /** The one line that says what this counts, or which map it came from. */
  note: string;
}) {
  const share = limit > 0 ? Math.min(used / limit, 1) : 0;
  const color = share >= 0.9 ? "danger" : share >= 0.75 ? "warning" : "accent";

  return (
    <Card className="h-full">
      <Card.Content className="flex h-full flex-col pt-5">
        <div className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-muted" />
          <h3 className="text-sm font-medium text-muted">{label}</h3>
        </div>

        <p className="mt-2 text-2xl font-semibold text-foreground">
          {formatCount(used)}
          <span className="text-base font-normal text-muted">
            {" "}
            of {formatCount(limit)}
          </span>
        </p>

        <Meter
          aria-label={label}
          value={used}
          minValue={0}
          maxValue={limit}
          valueLabel={`${formatCount(used)} of ${formatCount(limit)}`}
          color={color}
          className="mt-3"
        >
          <Meter.Track>
            <Meter.Fill />
          </Meter.Track>
        </Meter>

        <p className="mt-3 text-xs text-pretty text-muted">{note}</p>
      </Card.Content>
    </Card>
  );
}
