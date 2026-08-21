import { Chip } from "@heroui/react";

import { isApproximate } from "@/lib/geocoding/confidence";
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
 * pin" is useless advice about a pin the user placed on purpose. It is also why
 * only two of the three are chips. A chip is a sentence, and a sentence is the
 * right weight for "this pin might be in the wrong place" — but the third case is
 * a pin that is exactly where it should be, missing a house number, and giving
 * that the same size and shape as a real problem made every hand-dropped pin look
 * broken. It is an amber ring instead: visible at a glance, silent until asked.
 * The marker on the map stays plain — a ring on the canvas reads as a note about
 * the *position*, which is the one thing that is not wrong here.
 *
 * Nothing renders when everything is settled — a flag on every row would be noise.
 * `variant="soft"` pairs the status colour with its own foreground, which is the
 * only legible way to use these tokens (see place-count-badge.tsx).
 *
 * The ring is a compromise the 320px sidebar forced and the Locations table does
 * not have to make. In a column of its own there is room to say the word, and an
 * unlabelled amber circle whose only explanation is a `title` reaches nobody on a
 * keyboard or a phone. So `variant` picks between them: the sidebar and the map
 * card keep the ring, the table gets the chip. One component either way, because
 * two screens inventing their own amber is how they end up meaning two things.
 */
export function PlaceStatusFlag({
  status,
  confidence,
  variant = "ring",
}: {
  status: GeocodeStatus;
  /** 0–1, or null when no geocoder ever spoke for this row. */
  confidence?: number | null;
  /** How the approximate-address case is drawn. See above. */
  variant?: "ring" | "chip";
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

  if (isApproximate(status, confidence)) {
    if (variant === "chip") {
      return (
        <StatusChip
          color="warning"
          title="Approximate — we matched this pin to the street, not to a building. Add the house number if you know it."
        >
          Approximate
        </StatusChip>
      );
    }

    /*
     * A native `title` rather than a HeroUI Tooltip, and the same one the marker
     * carries. HeroUI's is React Aria, whose trigger has to be a focusable
     * component — this is a 14px ring, not a control, and making it pressable to
     * win a nicer tooltip would put it in the tab order as something you can
     * activate and nothing happens. `role="img"` with a name is what a screen
     * reader gets, since `title` alone on a non-focusable element reaches nobody.
     *
     * The amber comes from `--warning`, whose foreground partner is near-black and
     * so unusable as text (see place-count-badge.tsx) — as a border it needs no
     * partner, and holds against both the surface and a selected row's tint.
     */
    return (
      <span
        role="img"
        aria-label="Approximate address"
        title="Approximate — we matched this pin to the street, not to a building. Add the house number if you know it."
        className="size-3.5 shrink-0 rounded-full border-2 border-[var(--warning)]"
      />
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
