"use client";

import { Button, ScrollShadow } from "@heroui/react";
import { RotateCcw } from "lucide-react";

import {
  BlockProperties,
  type BlockPatch,
} from "@/components/card/designer/properties/block-properties";
import { ErrorMessage } from "@/components/ui/error-message";
import { blockPanelFacts } from "@/lib/card/block-panel-facts";
import { resizeCardBlock } from "@/lib/card/card-edits";
import type { AppMap, Place } from "@/lib/repositories/types";
import {
  findBlock,
  type CardBlock,
  type CardLayout,
} from "@/packages/shared/card-layout";
import {
  mergeCardBlocks,
  type CardBlockOverrides,
} from "@/packages/shared/card-overrides";
import { resolvePin } from "@/packages/shared/pin-icons";
import { useDeferredOverrides } from "./use-deferred-overrides";

/**
 * One block's settings, for this pin and no other.
 *
 * **It is the designer's own panel**, not a second one built to look like it.
 * `BlockProperties` is a walk over the block's declared `controls` with an
 * `onChange`, so pointing that `onChange` somewhere else is the whole of what
 * makes a per-pin editor -- and it means a control added to the studio appears
 * here on the same day, wired, rather than being a thing somebody has to
 * remember to add twice.
 *
 * **Every change takes effect immediately, and is saved once.** The card behind
 * the popover repaints from a preview channel with no round trip at all, and the
 * row is written on a trailing timer -- see `useDeferredOverrides`, which holds
 * the whole argument. There is no form and nothing to submit, so there is no
 * Save; Done is a way to close, and it flushes on the way out like every other
 * exit.
 *
 * ### How a patch becomes an override
 *
 * The patch is applied to the layout **as this location already draws it**, and
 * the resolved block is read back out:
 *
 *   effective = mergeCardBlocks(account layout, this pin's overrides)
 *   next      = resizeCardBlock(effective, blockId, patch)
 *   store     = findBlock(next, blockId).block
 *
 * Round-tripping through `resizeCardBlock` rather than assembling the block here
 * is what stops this panel and the studio becoming two opinions about what a
 * block can be. That one function already clamps every number, refuses a patch
 * naming a control the type does not offer, and *deletes* a field when it
 * returns to its default -- so "back to square corners" stores the absence of a
 * radius rather than a word meaning square, which is what every card published
 * before the control existed already says (CLAUDE.md §7).
 *
 * **`overrides` and not `place.cardBlocks`**, and that is the second half of the
 * flicker fix. The base a patch is applied to has to be what is on screen, which
 * while a change is uncommitted is the preview -- reading the cache would build
 * the next edit on top of whatever a round trip last left there.
 */
export function BlockEditorForm({
  map,
  place,
  block,
  layout,
  overrides,
  onPreview,
  onDone,
}: {
  map: AppMap;
  place: Place;
  /** The block as this location draws it -- already overridden. */
  block: CardBlock;
  /** The account's design, which the patch is applied against. */
  layout: CardLayout;
  /** This pin's overrides **as the card is drawing them** -- preview included. */
  overrides: CardBlockOverrides;
  /** Repaint the card now, before anything is saved. */
  onPreview: (overrides: CardBlockOverrides | null) => void;
  onDone: () => void;
}) {
  const { write, flush, error } = useDeferredOverrides(
    map.id,
    place.id,
    onPreview,
  );

  const effective = mergeCardBlocks(layout, overrides);
  const found = findBlock(effective, block.id);

  // The design could have changed under an open popover — a second tab saving
  // the card, say. A guard rather than a case: `renderOverlay` only ever draws
  // this over a block the layout has.
  if (!found) return null;

  const facts = blockPanelFacts(effective, found.zone, found.index, found.block);
  const isOverridden = Boolean(overrides[block.id]);

  const apply = (patch: BlockPatch) => {
    const next = resizeCardBlock(effective, block.id, patch);
    const resolved = findBlock(next, block.id);
    if (!resolved) return;

    write({ ...overrides, [block.id]: resolved.block });
  };

  const reset = () => {
    // Rebuilt without this block rather than with the key set to undefined: the
    // record is serialised whole into one column, and an `undefined` would ride
    // through `JSON.stringify` as a dropped key on the way out but sit in the
    // optimistic cache as a present one on the way in — so the card would keep
    // drawing the override until the round trip landed.
    const rest = { ...overrides };
    delete rest[block.id];

    write(rest);
    // A press, not a drag: there is no second one coming, so holding it for the
    // timer buys nothing but a moment of latency.
    flush();
  };

  return (
    /*
     * 24rem, which is the width the studio's own sidebar arrived at and
     * documents at length: at 20rem every control in here is at its floor, the
     * five-tile scales overflow sideways, and the panel grows a horizontal
     * scrollbar to say so. Two panels drawing the same controls have to be the
     * same width, or one of them is broken.
     *
     * `min-h-0` and `flex-1` on the scroller rather than a `dvh` cap: React Aria
     * already computes a max height for the popover from the room actually below
     * the block, and an inner element with a taller bound of its own is what let
     * this overflow the popover, extend the document, and give the *page* a
     * scrollbar. Bounded here, the footer also stays on screen rather than
     * scrolling away with the controls.
     */
    <div className="flex min-h-0 w-96 max-w-[calc(100vw-2rem)] flex-col gap-3">
      {/* `overflow-x-hidden` is written out beside it deliberately: a lone
          `overflow-y: auto` leaves the other axis `visible`, which CSS then
          computes to `auto` — so a scroller declaring one axis quietly gets
          both, and a control one pixel too wide grows a horizontal bar.

          **The bar itself is hidden, and that is a layout fix rather than a
          tidy-up.** A native scrollbar takes 15px out of the content box, and
          React Aria recomputes this popover's `maxHeight` on every
          `ResizeObserver` tick — so every fold that animates its height, and
          every dropdown that opens over it, walked the content across the
          overflow boundary and reflowed the whole 24rem column by 15px each
          way. Measured on the Button block: 866px of controls in a 632px box,
          `offsetWidth` 384 against `clientWidth` 369.

          `ScrollShadow hideScrollBar` is the call `DesignerTabPanel` already
          makes for the studio's own copy of these controls
          (components/card/designer/card-designer-tabs.tsx) — and the two panels
          draw the same `BlockProperties`, so a scroller that looks different
          depending on which opened it is two scrollers. The fade stays: with the
          bar gone it is the only thing saying the panel continues past the
          fold. */}
      <ScrollShadow
        hideScrollBar
        size={24}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1"
      >
        <BlockProperties
          block={found.block}
          fields={map.fields}
          cardPadding={effective.padding}
          overlapsNothing={facts.overlapsNothing}
          aloneOnLine={facts.aloneOnLine}
          // Whether this location's pin already carries a mark, which is the
          // fallback `logoImageOf` reaches for.
          logoHasImage={Boolean(resolvePin(place.icon, map.pinIcons)?.image)}
          // The sample *is* the location, which is the whole point of opening
          // this from its own card — see `isOwnCard` in `LogoProperties`.
          logoSample={place}
          isOwnCard
          mapId={map.id}
          onChange={apply}
        />
      </ScrollShadow>

      {error ? <ErrorMessage error={error} /> : null}

      {/*
        Offered only once there is something to undo, on the rule the route
        tool's Recalculate follows: a control that is pressed to be handed back
        exactly what is on screen is one that reads as broken.

        It says "card design" rather than "default", because that is what it goes
        back *to* — the design this account arranged for every pin, which is not
        the same thing as an unstyled block.
      */}
      <div className="flex shrink-0 justify-between gap-2">
        {isOverridden ? (
          <Button size="sm" variant="tertiary" onPress={reset}>
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Reset to card design
          </Button>
        ) : (
          <span />
        )}

        {/* Flushed before the panel goes rather than left to the unmount:
            identical in effect, and it keeps the one exit somebody presses on
            purpose from depending on a cleanup running. */}
        <Button
          size="sm"
          variant="tertiary"
          onPress={() => {
            flush();
            onDone();
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
