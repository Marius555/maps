import { Chip } from "@heroui/react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import type { Delta } from "@/lib/analytics/view";

/**
 * How a headline figure moved against the period before, as a chip.
 *
 * Green up, red down — for these figures more is better, so direction and good
 * are the same thing. **Never colour alone**: the arrow and the signed number
 * say it too, which keeps the chip readable in forced-colors mode and for
 * anyone who cannot separate the two hues.
 *
 * No previous period — a map in its first month, or one whose earlier days
 * aged out — is "New" rather than "+∞%". That is a fact about the map being
 * new, not about the map, and the chip says the true thing.
 */
export function TrendChip({ delta }: { delta: Delta }) {
  if (delta.change === null) {
    return (
      <Chip size="sm" variant="soft" color="default">
        New
      </Chip>
    );
  }

  const percent = Math.abs(Math.round(delta.change * 100));

  // Rounds to nothing: a 0.3% wobble is "flat", not a green arrow.
  if (percent === 0) {
    return (
      <Chip size="sm" variant="soft" color="default">
        <ArrowRight aria-hidden="true" className="size-3" />
        <Chip.Label>0%</Chip.Label>
      </Chip>
    );
  }

  const isUp = delta.change > 0;
  const Arrow = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <Chip size="sm" variant="soft" color={isUp ? "success" : "danger"}>
      <Arrow aria-hidden="true" className="size-3" />
      <Chip.Label className="tabular-nums">
        {isUp ? "+" : "−"}
        {percent}%
      </Chip.Label>
    </Chip>
  );
}
