import { Chip } from "@heroui/react";

import { HIGH_CONFIDENCE } from "@/lib/geocoding/confidence";
import type { GeocodeStatus } from "@/lib/validation/place.schema";

/**
 * Flags a location we aren't sure about, in the two different ways that happens.
 *
 * **The pin.** An import placed it from a text address, and the geocoder was
 * vague or failed outright — so the marker may be in the wrong place and the fix
 * is to drag it. That is `geocodeStatus`.
 *
 * **The address.** Someone dropped the pin themselves, so the position is exactly
 * right and `geocodeStatus` is "manual" — but the address was read back off the
 * map, and reverse geocoding only reaches the building when the pin is on one.
 * Off a footprint the honest answer is the street with no number, and the row
 * should say so rather than presenting a half-address as the whole one. That is
 * `geocodeConfidence`.
 *
 * Telling them apart matters because they ask for opposite things: "check the
 * pin" is useless advice about a pin the user placed on purpose.
 *
 * Nothing renders when both are settled — a chip on every row would be noise.
 * `variant="soft"` pairs the status colour with its own foreground, which is the
 * only legible way to use these tokens (see place-count-badge.tsx).
 */
export function PlaceStatusChip({
  status,
  confidence,
}: {
  status: GeocodeStatus;
  /** 0–1, or null when no geocoder ever spoke for this row. */
  confidence?: number | null;
}) {
  if (status === "failed") {
    return (
      <StatusChip
        color="danger"
        title="We couldn't find this address. Drag the pin to place it."
      >
        Not placed
      </StatusChip>
    );
  }

  if (status === "low") {
    return (
      <StatusChip
        color="warning"
        title="This address only matched roughly. Check the pin."
      >
        Check
      </StatusChip>
    );
  }

  /*
   * Only for a pin someone placed. An "ok" row was geocoded from a full address
   * and already carries a house number; re-flagging it on the same threshold
   * would put a chip on rows that are exactly as precise as we promised.
   */
  if (
    status === "manual" &&
    typeof confidence === "number" &&
    confidence < HIGH_CONFIDENCE
  ) {
    return (
      <StatusChip
        color="warning"
        title="We matched this pin to the street, not to a building. Add the house number if you know it."
      >
        Approximate
      </StatusChip>
    );
  }

  return null;
}

function StatusChip({
  color,
  title,
  children,
}: {
  color: "danger" | "warning";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Chip size="sm" variant="soft" color={color} className="shrink-0" title={title}>
      {children}
    </Chip>
  );
}
