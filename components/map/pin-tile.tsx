"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import { pickedTileClass } from "@/components/ui/picked-tile";
import {
  CUSTOM_PIN_PREFIX,
  PIN_ICONS,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";
import { PinPreview } from "./pin-preview";

/**
 * One pin, as something you can press.
 *
 * Used by the add menu's grid, the studio's library and the location edit form,
 * so a pin looks and behaves the same in all three. The alternative — a tile per
 * consumer — is how the thing you picked and the thing you got start disagreeing.
 *
 * Plain `<button>` rather than HeroUI's, and that is deliberate. React Aria's
 * `usePress` ends its `onPointerDown` with `stopPropagation()`, which is the whole
 * reason `use-drag-to-add` has to listen in the capture phase; putting one of
 * those between the pointer and the gesture buys nothing. These need no press
 * behaviour beyond `onClick`.
 *
 * The preview itself is `PinPreview`, which is the same `pinSvg` the ghost and
 * the markers draw — including the custom pin's own colour. A second drawing of
 * the same pin is how the tile you pressed and the pin you got drift apart.
 */

export type DragProps = {
  onPointerDownCapture: (event: ReactPointerEvent) => void;
  style: CSSProperties;
};

export function PinTile({
  icon,
  pinIcons,
  label,
  size = "md",
  isArmed,
  isDisabled,
  dragProps,
  onPress,
}: {
  /** "" for a plain pin, a built-in id, or `custom:<id>`. */
  icon: string;
  pinIcons: CustomPinIcon[];
  /** Overrides the pin's own name. Only the plain pin has none of its own. */
  label?: string;
  /**
   * `lg` where the tile is the thing being chosen rather than one entry in a
   * list — the studio's carousels give each tile a quarter of the dialog, and a
   * 36px pin adrift in that much space reads as a mistake. It fills its
   * container too, so the press area and the slot are the same rectangle.
   */
  size?: "md" | "lg";
  isArmed?: boolean;
  isDisabled?: boolean;
  /** Omitted where a drag cannot end in a marker — inside a dialog, say. */
  dragProps?: DragProps;
  onPress: () => void;
}) {
  const name = label ?? pinLabel(icon, pinIcons);

  return (
    <button
      type="button"
      aria-pressed={isArmed}
      disabled={isDisabled}
      title={name}
      {...dragProps}
      onClick={onPress}
      className={`${pickedTileClass(Boolean(isArmed))} flex flex-col items-center gap-1.5 p-2 text-center disabled:cursor-not-allowed disabled:opacity-40 ${
        dragProps ? "cursor-grab active:cursor-grabbing" : ""
      } ${size === "lg" ? "w-full" : ""}`}
    >
      <PinPreview icon={icon} pinIcons={pinIcons} size={size} />
      <span className="w-full truncate text-xs leading-tight text-muted">{name}</span>
    </button>
  );
}

/**
 * A pin's name, wherever it lives.
 *
 * Dashboard-only, which is why it is not on `resolvePin`: the embed has no use
 * for it and the snapshot drops it, so carrying it through the shared resolver
 * would be weight in the visitor's download for something nothing renders.
 */
export function pinLabel(icon: string, pinIcons: CustomPinIcon[]): string {
  if (icon.startsWith(CUSTOM_PIN_PREFIX)) {
    const id = icon.slice(CUSTOM_PIN_PREFIX.length);
    return pinIcons.find((entry) => entry.id === id)?.label ?? "Pin";
  }

  return PIN_ICONS.find((entry) => entry.id === icon)?.label ?? "Plain";
}
