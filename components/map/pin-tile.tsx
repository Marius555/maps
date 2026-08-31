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
  describedBy,
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
  /**
   * Names the element saying *why* this tile is off — the warning line under the
   * grid. Read out after the label, so the reason arrives with the tile rather
   * than as a sentence somewhere else on screen.
   */
  describedBy?: string;
  /** Omitted where a drag cannot end in a marker — inside a dialog, say. */
  dragProps?: DragProps;
  onPress: () => void;
}) {
  const name = label ?? pinLabel(icon, pinIcons);

  return (
    /*
     * `aria-disabled`, not the native `disabled` attribute.
     *
     * A disabled button leaves the tab order, and the whole point of switching
     * these off is to say why — so the native version offers the tile to a
     * pointer and hides both the tile and its explanation from anyone arriving
     * by keyboard (§8's quality floor). This keeps it focusable, announced as
     * disabled, and carrying `describedBy`; the press is refused here instead.
     *
     * That means the drag has to be refused here too. `disabled` used to do it
     * for free by suppressing pointer events, so the props are dropped rather
     * than spread — one guard in the tile, instead of trusting every caller to
     * withhold them. It also drops `touchAction: none`, giving a finger on a
     * dead tile the page scroll back.
     */
    <button
      type="button"
      aria-pressed={isArmed}
      aria-disabled={isDisabled}
      aria-describedby={isDisabled ? describedBy : undefined}
      title={name}
      {...(isDisabled ? {} : dragProps)}
      onClick={isDisabled ? undefined : onPress}
      className={`${pickedTileClass(Boolean(isArmed), isDisabled)} flex flex-col items-center gap-1.5 p-2 text-center ${
        size === "lg" ? "w-full" : ""
      }`}
    >
      {/* Grey rather than faded. `disabled:opacity-40` was what this used to
          wear, and a 40% pin on a dark surface is one you cannot see rather
          than one you are told not to press — the argument the unroutable
          marker settles in app/globals.css. */}
      <PinPreview icon={icon} pinIcons={pinIcons} size={size} isMuted={isDisabled} />
      {/* The name does not fade with the pin, and it used to. `text-muted/60`
          was readable while a disabled tile was transparent; now that the tile
          carries the hover fill the label sits on a *lighter* ground than
          before, and 60% of a muted grey on it lands near 2:1 — blurred rather
          than switched off. Nothing is lost by dropping it: the drained pin and
          the plate under it already say the tile is off, and which pin it is
          stays worth reading precisely because you cannot have it. */}
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
