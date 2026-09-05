"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { resolvePin } from "@/packages/shared/pin-icons";

import { CardView } from "@/components/card/card-view";
import { cardSlotOf } from "@/lib/card/card-slots";
import type { AppMap, MapField, Place } from "@/lib/repositories/types";
import type { CardBlock, CardLayout } from "@/packages/shared/card-layout";
import type { CardBlockOverrides } from "@/packages/shared/card-overrides";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import type { TagChip } from "@/packages/shared/tags";
import { useMapAnchor } from "../use-map-anchor";
import { PlaceCardChrome } from "./place-card-chrome";
import { BlockEditorPopover } from "./edit/block-editor-popover";
import { CardEditTarget } from "./edit/card-edit-target";
import { CardSlot } from "./slots/card-slot";

/** The gap that keeps the card off the pin, added to the card's own width. */
const FLIP_GAP = 22;

/**
 * What a location with nothing on it says for itself.
 *
 * Editor-only, passed rather than built into `CardView`, because it asks the
 * reader to go and edit the location — which a visitor to a customer's site can
 * neither do nor be told to do. The embed passes nothing and shows nothing.
 *
 * It sits under the card's blocks, where the reader's eye already is when it
 * runs out of things to read (CLAUDE.md §8: an empty state is an invitation).
 * The action it asks for is the pencil in the top corner — it used to be a
 * full-width Edit button directly beneath this line, and that button is now an
 * icon beside the close X. See `PlaceCardChrome`.
 *
 * **Only when there are no slots**, which in practice means only on a design
 * whose every block is a logo, a rule or a gap. A card covered in dashed `+`
 * boxes is already an invitation per block, each naming its own field, and a
 * card-wide sentence underneath repeating the general form of it is one message
 * too many — §8's rule is that the primary action is *right there*, and with
 * slots on, it is.
 */
function renderEmptyState() {
  return (
    <p className="px-[var(--card-pad)] pb-[var(--card-pad)] text-xs text-muted">
      No details yet. Add an address, description or contact details.
    </p>
  );
}

/**
 * Everything a location holds, beside its pin.
 *
 * Positioned by projecting the place's coordinates rather than through MapLibre's
 * `Popup`: a popup takes an HTML string or a detached DOM node, so React content
 * would have to be rendered into a portal inside a node the map owns and torn
 * down by hand. This is a plain absolutely-positioned element that follows the
 * map (see use-map-anchor.ts) and never leaves React's tree.
 *
 * Three nested elements, each with one job, because they cannot share a
 * `transform`: the anchor is moved per frame by the hook, the positioner holds
 * the static offset from the pin, and Motion owns the third for its animation.
 * Collapsing any two would have one of them overwriting another sixty times a
 * second.
 */
export function PlaceCard({
  map,
  isReady,
  place,
  layout,
  fields,
  tagChips,
  pinIcons,
  slots,
  onClose,
  onEdit,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  place: Place | null;
  /**
   * The card the owner designed, which the embed's popup draws from too.
   *
   * One layout, two renderers: what they arrange here is what a visitor gets,
   * which is the point of designing it in the dashboard at all.
   */
  layout: CardLayout;
  fields: MapField[];
  /**
   * This location's tags, resolved by the caller holding the map's vocabulary
   * and in the location's own order — the first is what colours its pin.
   */
  tagChips: TagChip[];
  /** The map's pins, for a card whose layout holds a Logo block. */
  pinIcons: CustomPinIcon[];
  /**
   * Turns every block this location left empty into a dashed `+` that fills it
   * in on the spot — see `cardSlotOf` and `CardSlot`.
   *
   * A prop group, and optional, on `MapCanvasProps`' own idiom for `shapes` and
   * `selection`: it is one feature that arrives whole or not at all, and the two
   * canvases that must not have it — the import review, drawing drafts that are
   * not rows yet, and the preview panel, which is a visitor's card — say so by
   * passing nothing.
   *
   * The whole `AppMap` because the tags slot opens `TagPicker`, whose quick-add
   * writes the map's own `tagGroups`. That is the one thing in here that edits
   * the map rather than the location.
   */
  slots?: { map: AppMap };
  onClose: () => void;
  onEdit?: (placeId: string) => void;
}) {
  // The card's own width now, not a constant — the owner can make it wider, and
  // the side the card flips to has to be decided from the width it will be.
  const anchor = useMapAnchor(map, isReady, place, layout.width + FLIP_GAP);
  const prefersReducedMotion = useReducedMotion();

  /**
   * The card's own box, which is what the block editor's panel is anchored to.
   *
   * Not the pencil that opens it, and that is the whole of why the panel holds
   * still: a block crossing 100% width changes DOM parent (`cardRows`, and the
   * two branches in `CardView`), so a popover anchored inside it is torn down
   * and rebuilt mid-edit, and one anchored to the badge follows the badge as the
   * block resizes. The card moves for neither. See `BlockEditorPopover`.
   */
  const cardRef = useRef<HTMLDivElement>(null);

  /**
   * Which block has a popover open, at most one, and which kind it is.
   *
   * Held here rather than inside each trigger because two things outside the
   * popover have to know about it: Escape, and the map moving. One piece of
   * state for both kinds — the dashed `+` that fills an empty block in, and the
   * pencil that redesigns any block — because those two guards do not care
   * which is open, only that something is.
   *
   * **It names the location as well as the block**, and `panel` below is
   * what that buys. The card is one surface that changes subject — it is not
   * keyed on `place.id`, deliberately (see the `motion.div`'s own comment) — so
   * picking a second pin has to close a popover about the first one's missing
   * phone number. Reading the pair during render answers that with no effect at
   * all, where resetting it in one would be a cascading render on every
   * selection.
   */
  const [openPanel, setOpenPanel] = useState<{
    placeId: string;
    blockId: string;
    /** Filling an empty block in, or redesigning one that already drew. */
    mode: "add" | "edit";
  } | null>(null);

  /**
   * Which location's card is in edit mode, if any.
   *
   * The **place id** rather than a boolean, for `openPanel`'s reason: the card
   * is one surface that changes subject, so a flag would have the next pin you
   * click arrive already in edit mode. Holding the id answers that during render
   * with no effect at all.
   */
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const isEditing = Boolean(place && editingCard === place.id);

  /**
   * What this location's card is drawing *before* any of it has been saved.
   *
   * The panel's controls fire per pointer-move — `ColorPickerField` emits a
   * colour a frame, which is right in the studio, where nothing leaves the page
   * until Save. Here every one of them used to be a `PATCH`, so a one-second
   * drag put sixty of them in flight, they came back out of order, and the last
   * reply to land won: the card walked backwards and forwards between colours.
   * Worse than a flicker, because the *next* patch was computed from the cache,
   * so a stale reply became the base for the following write and was saved.
   *
   * So the picture and the record are two channels. This is the picture: it goes
   * straight into `blockOverrides` and repaints under the pointer with no network
   * at all — the same preview channel a shape drag paints through — while
   * `useDeferredOverrides` writes the row once, on a trailing timer, and clears
   * this when the round trip lands.
   *
   * Keyed on the place for `openPanel`'s reason: the card is one surface that
   * changes subject, so an uncommitted preview of one pin's logo must not be
   * drawn over the next pin clicked. Read during render, which answers that with
   * no effect at all.
   */
  const [preview, setPreview] = useState<{
    placeId: string;
    overrides: CardBlockOverrides;
  } | null>(null);

  const panel = openPanel && place && openPanel.placeId === place.id ? openPanel : null;
  const openSlotId = panel?.mode === "add" ? panel.blockId : null;
  const openEditorId = panel?.mode === "edit" ? panel.blockId : null;
  /** Either kind of popover, which is what the two guards below care about. */
  const openPanelId = panel?.blockId ?? null;

  /**
   * This location's overrides as the card is actually drawing them.
   *
   * It is what `CardView` paints *and* what the next patch is applied to, and
   * those have to be the same record. Computing a patch from `place.cardBlocks`
   * mid-edit is the second half of the bug above: the cache is whatever the last
   * reply left there, so an edit made on top of it persisted the revert.
   */
  const effectiveOverrides =
    place && preview?.placeId === place.id
      ? preview.overrides
      : place?.cardBlocks;

  /*
   * Escape closes the card. On the window because focus may still be on the pin,
   * on the list row, or nowhere at all.
   *
   * Not while a slot is open, though: React Aria's own dialog is already
   * dismissing on that key, and one press would otherwise close the popover and
   * the card underneath it together — losing what was typed *and* the pin it
   * was about.
   */
  useEffect(() => {
    if (!place || openPanelId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [place, openPanelId, onClose]);

  /*
   * A moving map closes an open slot.
   *
   * The card follows the pin by a `transform` written every frame by
   * `useMapAnchor`, and a popover is portalled to the end of the body and
   * positioned once — so a pan would leave it standing still while the block it
   * belongs to slid out from under it. Closing is the honest answer, and it is
   * the same one Escape gives.
   */
  useEffect(() => {
    if (!openPanelId) return;

    const instance = map.current;
    if (!instance) return;

    const close = () => setOpenPanel(null);

    instance.on("movestart", close);
    return () => {
      instance.off("movestart", close);
    };
  }, [map, openPanelId]);

  /**
   * The slot a block is offering, or nothing — which is the answer for every
   * block this location filled in, and for every block on every card when the
   * caller passes no `slots` at all.
   */
  const renderSlot = slots
    ? (block: Parameters<typeof cardSlotOf>[0]) => {
        if (!place) return null;

        const slot = cardSlotOf(
          block,
          place,
          fields,
          tagChips,
          // Whether this location's pin already carries a mark — the fallback
          // `logoImageOf` reaches for, so a Logo block drawing one is not empty.
          Boolean(resolvePin(place.icon, pinIcons)?.image),
        );
        if (!slot) return null;

        return (
          <CardSlot
            map={slots.map}
            place={place}
            slot={slot}
            isOpen={openSlotId === block.id}
            onOpenChange={(isOpen) =>
              setOpenPanel(
                isOpen
                  ? { placeId: place.id, blockId: block.id, mode: "add" }
                  : null,
              )
            }
          />
        );
      }
    : undefined;

  /**
   * The pencil over a block, once this card is in edit mode.
   *
   * Every block gets one, filled in or not, which is the whole difference from
   * `renderSlot`: a slot appears where a location has nothing, and this is how
   * the design of what it *does* have is reached. On an empty block the two sit
   * together -- the dashed `+` is the block's content and this is a badge in its
   * corner -- which is why the badge is a corner and not the whole box. Two
   * press targets stacked on one 24px line is unusable, and the `+` is the one
   * that has to keep the box.
   */
  const renderOverlay =
    slots && isEditing
      ? (block: CardBlock, hasSlot: boolean) => {
          if (!place) return null;

          return (
            <CardEditTarget
              block={block}
              hasSlot={hasSlot}
              isOpen={openEditorId === block.id}
              onOpen={() =>
                setOpenPanel({
                  placeId: place.id,
                  blockId: block.id,
                  mode: "edit",
                })
              }
            />
          );
        }
      : undefined;

  return (
    <div
      ref={anchor}
      data-flip="right"
      className="map-card-anchor pointer-events-none absolute top-0 left-0 z-20"
    >
      {/* Vertically centred on the pin and to one side of it — the side the hook
          chose, from how much room is left before the frame's edge. Which side
          that is, is CSS: app/globals.css, keyed off the anchor's data-flip.
          Plain CSS rather than a Tailwind group-data variant because the hook
          writes the attribute at 60fps and this must not depend on a variant
          being generated. */}
      <div className="map-card-anchor__card">
        <AnimatePresence>
          {place ? (
            <motion.div
              // Constant, not `place.id` — see ShapeCard for the whole story.
              // Keyed on the id, picking a second location mounts the new card
              // while the old one is still exiting, and the previous location's
              // card ghosts through the new one. The card is one surface that
              // changes subject; the animation marks it opening and closing.
              key="card"
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.94 }
              }
              animate={{ opacity: 1, scale: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.94 }
              }
              transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
              /*
               * Capped against the map frame, not at a fixed 256px.
               *
               * It used to be the latter, and a location with opening hours —
               * seven rows plus a status line — overflowed it, so the common
               * case of filling the form in properly was rewarded with a
               * scrollbar inside a card the size of a business card. The frame
               * is `overflow-hidden`, though, so an uncapped card near the top
               * or bottom edge would be clipped instead. This is the height at
               * which neither happens; the body still scrolls past it, which now
               * takes a genuinely enormous location to reach.
               *
               * The cap itself is a CSS variable the anchor hook writes from the
               * map frame's height (app/globals.css keys `.map-card` off it), for
               * the same reason the flip side is CSS: it changes as the map is
               * resized, and this must not depend on a React render to keep up.
               */
              className="pointer-events-auto"
              role="dialog"
              aria-label={place.name}
            >
              {/* `map-card` carries the height cap the anchor hook writes from
                  the map frame, and the floor beside it, so it belongs on the
                  element that actually is the card — see the note above. */}
              <CardView
                ref={cardRef}
                layout={layout}
                place={place}
                fields={fields}
                tagChips={tagChips}
                pinIcons={pinIcons}
                className="map-card relative border border-border"
                // The slots say it per block, and better — see the docblock on
                // `renderEmptyState`.
                renderEmptyState={slots ? undefined : renderEmptyState}
                renderSlot={renderSlot}
                blockOverrides={effectiveOverrides}
                renderOverlay={renderOverlay}
              >
                <PlaceCardChrome
                  place={place}
                  isEditing={isEditing}
                  onToggleEdit={
                    slots
                      ? () => {
                          // Leaving edit mode takes any open panel with it: the
                          // popover is portalled, so it would otherwise stand
                          // there with nothing on the card still marked.
                          setOpenPanel(null);
                          setEditingCard(isEditing ? null : place.id);
                        }
                      : undefined
                  }
                  onClose={onClose}
                  onEdit={onEdit}
                />
              </CardView>

              {/*
                One panel, outside the layout, for whichever block is open.
                Above `CardView` rather than inside a block, because a block is
                not a stable place to keep a dialog — see `BlockEditorPopover`,
                which holds the whole argument.

                Mounted only while a block is open, so leaving by any route
                unmounts `useDeferredOverrides` and flushes what it is holding.
                That is what Escape, a click outside and the map's `movestart`
                all rely on, and it is why this is not simply left mounted with
                an `isOpen` of its own.
              */}
              {slots && openEditorId ? (
                <BlockEditorPopover
                  map={slots.map}
                  place={place}
                  layout={layout}
                  overrides={effectiveOverrides ?? {}}
                  blockId={openEditorId}
                  cardRef={cardRef}
                  onPreview={(overrides) =>
                    setPreview(
                      overrides ? { placeId: place.id, overrides } : null,
                    )
                  }
                  onClose={() => setOpenPanel(null)}
                />
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
