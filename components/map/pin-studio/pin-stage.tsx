"use client";

import { Surface } from "@heroui/react";

import { PinPreview } from "@/components/map/pin-preview";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * The pin you are making, and nothing else.
 *
 * On a desktop it is the builder's left column and holds still while the
 * controls on the right scroll — PinStudio makes it sticky. On a phone it sits in
 * the sheet's header, `compact`, for the same reason: the pin has to stay in view
 * while you change it. Its name is the first field on the right (PinFields); it
 * used to sit under the pin here, alone in a column with nothing else in it.
 *
 * The pin stands on a dotted "map" ground rather than a blank panel. A pin on a
 * blank card looks like an avatar; on a ground it looks like what it is, a
 * marker, and a white ring or a pale icon colour has something to read against.
 * The dots are the theme's own border token, so they follow light and dark.
 */
export function PinStage({
  draft,
  compact = false,
}: {
  draft: CustomPinIcon;
  /** The phone sheet's header: a small square rather than the column's width. */
  compact?: boolean;
}) {
  return (
    <Surface
      variant="secondary"
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-2xl ${
        compact ? "size-20" : "aspect-square w-full"
      }`}
      style={{
        backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    >
      {/* The resolver takes a library and an id, so the draft is handed to it as
          a one-entry library — the same drawing path the markers take. */}
      <PinPreview
        icon="custom:preview"
        pinIcons={[{ ...draft, id: "preview" }]}
        size="xl"
        className={compact ? "scale-75" : "scale-125"}
      />
    </Surface>
  );
}
