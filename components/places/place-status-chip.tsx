import { Chip } from "@heroui/react";

import type { GeocodeStatus } from "@/lib/validation/place.schema";

/**
 * Flags a location whose position we aren't sure about.
 *
 * Only the two statuses that mean "check this" render anything — a chip on every
 * row would be noise, and "ok" and "manual" both mean the pin is where it should
 * be. `variant="soft"` pairs the status colour with its own foreground, which is
 * the only legible way to use these tokens (see place-count-badge.tsx).
 */
export function PlaceStatusChip({ status }: { status: GeocodeStatus }) {
  if (status === "ok" || status === "manual") return null;

  const isFailed = status === "failed";

  return (
    <Chip
      size="sm"
      variant="soft"
      color={isFailed ? "danger" : "warning"}
      className="shrink-0"
      title={
        isFailed
          ? "We couldn't find this address. Drag the pin to place it."
          : "This address only matched roughly. Check the pin."
      }
    >
      {isFailed ? "Not placed" : "Check"}
    </Chip>
  );
}
