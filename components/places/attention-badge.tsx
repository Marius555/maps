"use client";

import { Button } from "@heroui/react";

/**
 * How many locations need a look, and the shortest route to them.
 *
 * A count on its own would be a fact with nowhere to go — the number is only
 * useful because pressing it filters the list down to exactly those rows, and
 * pressing it again puts everything back. That round trip is the difference
 * between the page telling you something is wrong and the page helping.
 *
 * Nothing renders when the count is zero. A permanent "0 need attention" is
 * clutter on a healthy map, and its absence is the same signal said quietly.
 *
 * A `Button` rather than a Chip, because it does something. A pressable Chip is a
 * control disguised as a label, which is how a keyboard user ends up tabbing onto
 * something with no idea it can be activated.
 *
 * **The label does not change when it is pressed**, and that is deliberate. It
 * used to read `Showing 4 locations need attention` while active, which made the
 * button change width on every press and shove the rest of the row around — the
 * one control in the toolbar that resized itself as a side effect of being used.
 * The state is told by the variant and by `aria-pressed`, which is what that
 * attribute is for; the filtered count is said once, by the status line beside
 * it, rather than twice in two different shapes.
 */
export function AttentionBadge({
  count,
  isActive,
  onShow,
}: {
  count: number;
  /** True while the list is already filtered to these rows. */
  isActive: boolean;
  onShow: () => void;
}) {
  if (count === 0) return null;

  const label = `${count} ${count === 1 ? "location needs" : "locations need"} attention`;

  return (
    <Button
      size="sm"
      variant={isActive ? "secondary" : "tertiary"}
      aria-pressed={isActive}
      className="tabular-nums"
      onPress={onShow}
    >
      {label}
    </Button>
  );
}
