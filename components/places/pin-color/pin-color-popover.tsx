"use client";

import { Popover, popoverVariants } from "@heroui/react";
import { useMemo, type RefObject } from "react";

import { ColorSwatchRow } from "@/components/ui/color-swatch-row/color-swatch-row";
import { PALETTE_PRESETS } from "@/components/ui/color-swatch-row/presets";
import { usePinColorDraft } from "./use-pin-color-draft";

/**
 * A location's own pin colour, opened from its row's ⋯ menu.
 *
 * It was a field in Edit location, where on a grouped location it saved and
 * then changed nothing (its group's colour sat above it), and where a "Use
 * theme colour" button was the only way back. Now the way back is the first
 * swatch: **the colour this pin wears with no colour of its own** — its group's
 * when it is in one, otherwise its first tag's or the map's Default pin colour —
 * and pressing it clears the location's colour rather than storing a copy of
 * that one, so the pin keeps following the group or tag if either changes.
 *
 * A standalone `Popover.Content` anchored to the row, for `BlockEditorPopover`'s
 * reason: the trigger is a menu item that is gone by the time this opens, and a
 * `Popover.Root` without a pressable child logs on every open. The slot classes
 * `Popover.Root` would supply are passed from `popoverVariants()` instead.
 *
 * Mounted only while open, so each opening starts its draft from the row.
 */
export function PinColorPopover({
  mapId,
  placeId,
  placeName,
  color,
  themeColor,
  isGrouped,
  hasPinColor,
  anchorRef,
  onClose,
}: {
  mapId: string;
  placeId: string;
  placeName: string;
  /** The location's own colour, or "" for none. */
  color: string;
  /** What it wears with none — see `pinThemeColor`. */
  themeColor: string;
  /** The first swatch is then the group's colour, and is named for it. */
  isGrouped: boolean;
  /** Its custom pin carries a colour, which beats anything picked here. */
  hasPinColor: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const slots = useMemo(() => popoverVariants(), []);
  const { draft, commit, preview, flush } = usePinColorDraft({
    mapId,
    placeId,
    saved: color,
  });

  const label = `Pin colour for ${placeName}`;

  /*
   * A preset equal to the first swatch is dropped rather than shown twice: the
   * row keys its swatches on colour, and groups and tags are handed their
   * colours from this same palette, so the clash is the common case.
   */
  const presets = PALETTE_PRESETS.filter((preset) => preset.color !== themeColor);

  return (
    <Popover.Content
      isOpen
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        flush();
        onClose();
      }}
      triggerRef={anchorRef}
      placement="bottom end"
      className={slots.base()}
    >
      <Popover.Dialog aria-label={label} className={slots.dialog()}>
        <div className="flex max-w-[calc(100vw-3rem)] flex-col gap-2 p-0.5">
          <p className="text-sm font-medium text-foreground">Pin colour</p>

          <ColorSwatchRow
            label={label}
            hideLabel
            value={draft}
            leading={{
              kind: "color",
              color: themeColor,
              name: isGrouped ? "Group colour" : "Theme colour",
              emit: "",
            }}
            presets={presets}
            fallback={themeColor}
            onChange={(hex, source) => {
              const next = hex ?? "";

              if (source === "custom") {
                preview(next);
                return;
              }

              // A swatch press is an answer.
              commit(next);
              onClose();
            }}
          />

          <p className="max-w-60 text-xs text-muted">
            {hasPinColor
              ? "This location's custom pin has its own colour, which is used instead."
              : isGrouped
                ? "The first colour follows its group."
                : "Colours the pin and its card."}
          </p>
        </div>
      </Popover.Dialog>
    </Popover.Content>
  );
}
