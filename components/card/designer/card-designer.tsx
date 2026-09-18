"use client";

import { Button, toast } from "@heroui/react";
import { RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cardAccentVars } from "@/components/card/card-frame";
import { cardThemeClass } from "@/lib/card/card-theme";
import { usePrefersDark } from "@/lib/theme/use-prefers-dark";
import { RowDragProvider } from "@/components/groups/row-drag-context";
import { IconButton } from "@/components/ui/icon-button";
import {
  dropCardBlock,
  removeCardBlock,
  resizeCardBlock,
  type CardDrag,
  type CardDropTarget,
} from "@/lib/card/card-edits";
import type { VacatedSpace } from "@/lib/card/drop-slots";
import { useCardDesign, useUpdateCardDesign } from "@/lib/query/card-design";
import { usePlaces } from "@/lib/query/places";
import { toastError } from "@/lib/query/toast-error";
import type { AppMap, Place } from "@/lib/repositories/types";
import {
  readCardLayout,
  sameCardLayout,
} from "@/lib/validation/card-layout.schema";
import {
  defaultCardLayout,
  emptyCardLayout,
  isSavedCardLayout,
  type CardLayout,
} from "@/packages/shared/card-layout";
import { resolvePin } from "@/packages/shared/pin-icons";
import { pinColorOfChips, tagChipsOf } from "@/packages/shared/tags";
import { previewChips } from "@/lib/card/preview-chips";
import { SAMPLE_CHIP_COUNT, SAMPLE_PLACE } from "@/lib/card/sample-place";
import { BlockPalette } from "./block-palette";
import type { BlockResize } from "./block-resize-handle";
import { CardCanvas, type LandedBlock } from "./card-canvas";
import {
  CardDesignerTabs,
  TAB_TITLES,
  UnsavedDot,
  type DesignerTab,
} from "./card-designer-tabs";
import { DesignerCanvasArea } from "./designer-canvas-area";
import { DesignerSidePanel } from "./designer-side-panel";
import { CardProperties } from "./properties/card-properties";

/**
 * How long a landing block is marked as landing, in ms — counted from the
 * commit that draws the landing, not from the drop (see the effect after
 * `onDrop`).
 *
 * Clearing it does not stop the landing — the bounce and the impact ring are
 * started imperatively and run to their own end (components/card/designer/
 * use-landing.ts). What the flag holds is the rest of the arrival: the block's
 * own travel switched off (`movingBlockTravel`) and a new block's line fading
 * in, both decided in the commit the drop causes. It is kept past the landing's
 * 420ms anyway, so nothing about the block changes while it is still moving.
 */
const LANDED_MS = 450;

/**
 * Where the location card is designed.
 *
 * **One design for the whole account**, not per map — every map an owner has
 * shares one popup, because a customer with three maps wants to redesign the
 * card once. This page still opens from inside a particular map (it's the
 * natural place to reach it from, and the map's own locations are what the
 * canvas draws a real sample against), but what it reads and saves is the
 * account's own design — see lib/repositories/card-design.repository.ts.
 *
 * **This is a dashboard tool and only a dashboard tool.** What it produces is
 * baked into the published snapshot, so a visitor gets a finished card and never
 * a designer — none of this code reaches the embed, and nothing on a customer's
 * site can rearrange anything.
 *
 * **Nothing here reaches a real card until Save is pressed**, and that is the
 * one rule this component exists to hold. Every gesture writes `draft`, which is
 * what the canvas draws; `updateCardDesign` is called from exactly one place.
 * Saving per gesture is what this used to do, and it made the tool unusable for
 * the thing it is for: a card is *tried*, and forty PATCHes on the way to a
 * layout means forty different cards on the customer’s live map, each of them
 * one somebody was in the middle of. It also means a card can be abandoned —
 * close the tab and the saved design is the one that was saved.
 *
 * The price is a draft that can be lost, which is what the `beforeunload` guard
 * below is for, and a Save button that has to know whether anything actually
 * changed — `sameCardLayout`, which compares two resolved layouts rather than
 * two objects, because a draft is assembled by a dozen small edits and key order
 * is not something a button should be live about.
 */
export function CardDesigner({
  map: initialMap,
  initialPlaces,
  initialCardDesign,
}: {
  map: AppMap;
  initialPlaces: Place[];
  initialCardDesign: Record<string, unknown>;
}) {
  const { data: places = [] } = usePlaces(initialMap.id, initialPlaces);
  // Only Auto consults this, and it is the dashboard's resolved theme rather
  // than the OS's preference — see `cardThemeClass`.
  const prefersDark = usePrefersDark();
  const { data: design = initialCardDesign } = useCardDesign(initialCardDesign);
  const updateCardDesign = useUpdateCardDesign();

  /*
   * An account that has never saved a design opens onto **the same card its
   * published map already draws**, and that is a correction.
   *
   * This used to fall back to `emptyCardLayout()`, on the reasoning that
   * opening a designer onto a card "already half-built by nobody" is confusing.
   * The premise was wrong in one specific way: that card is not built by
   * nobody, it is what the product does. A live unconfigured site publishes
   * `defaultCardLayout()` through `resolveCardLayout` — name, address,
   * description, tags, hours, links, photo — so a blank canvas here was the one
   * screen in the app disagreeing with the thing it exists to show. An owner
   * arriving to "design my card" was told their card was empty when it was not.
   *
   * `isSavedCardLayout` is still what separates the two cases, and still has to
   * be: a card somebody deliberately *cleared* round-trips as three empty zones
   * and must come back empty, not be quietly refilled. That is the invariant in
   * docs/notes/cards.md — these functions may change what a fresh card is, never
   * what a saved one becomes.
   */
  const saved = useMemo(
    () =>
      isSavedCardLayout(design) ? readCardLayout(design) : defaultCardLayout(),
    [design],
  );

  /*
   * The layout being edited, held here rather than read back off the cache.
   *
   * A resize writes sixty times a second and only the last one is saved, so the
   * canvas has to be able to show a value the server has not been told about
   * yet. Seeded from the row and never re-seeded: this page is one editing
   * session, and pulling the saved value back in mid-drag would fight the hand
   * holding the handle.
   */
  const [draft, setDraft] = useState<CardLayout>(saved);
  /**
   * The last layout the server was told about, and the only thing `draft` is
   * compared against.
   *
   * Not `saved` itself, which is derived from the query cache and would go
   * stale in the other direction — a refetch landing mid-session would make the
   * Save button light up for a change nobody made. This moves on exactly two
   * events: the page loading, and a save coming back.
   */
  const [baseline, setBaseline] = useState<CardLayout>(saved);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * The block the last drop put down, while its landing is still playing. Null
   * the rest of the time, which is nearly all of it. See `landingBlockMotion`
   * and the note in `onDrop`.
   */
  const [justLanded, setJustLanded] = useState<LandedBlock | null>(null);

  /*
   * Which of the sidebar's two jobs is showing. Selecting a block — on the
   * canvas, or by dropping a new one — switches here to "modify" so its
   * controls are on screen without a second click; deselecting leaves the
   * tab where it is, since "modify" still has something to show (the whole
   * card's own properties) with nothing selected.
   */
  const [activeTab, setActiveTab] = useState<DesignerTab>("elements");

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setActiveTab("modify");
  }, []);

  /*
   * Whether the sidebar is showing, which only means anything below `lg` —
   * above it the panel is a column of the page and is simply there. See
   * `DesignerSidePanel`.
   *
   * A plain boolean, where it used to record *how* it opened. There were two
   * ways in and they differed in whether focus moved with the panel: a trigger
   * portalled into the app's mobile header was a deliberate move from the other
   * end of the screen and took focus; a tap on a block was not. The sheet's grab
   * rail is on screen at every width below `lg` now, so that trigger is gone and
   * with it the distinction.
   */
  const [isPanelOpen, setPanelOpen] = useState(false);

  /*
   * Selecting a block **on the canvas** also brings the panel out, which
   * `select` alone deliberately does not do.
   *
   * The two paths cannot share one rule, and that is why this is a second
   * function rather than two more lines inside `select`. A *drop* selects what
   * landed too, and a drop must leave the panel shut — `DesignerSidePanel`
   * closes it at the end of every palette drag precisely so the card is visible
   * at the moment it has just changed. Since `use-row-drag.ts` clears `dragged`
   * *before* it calls the target's `onDrop`, an open requested from inside
   * `select` would land in the same commit as that close and the two would
   * fight over one boolean. Only the canvas asks; the drop path never does.
   *
   * Above `lg` this is a no-op in effect: the panel is a column of the page and
   * `isPanelOpen` means nothing there.
   */
  const selectOnCanvas = useCallback(
    (id: string | null) => {
      select(id);
      if (id) setPanelOpen(true);
    },
    [select],
  );

  /*
   * A local stand-in photo for a gallery block, when today's sample location
   * has none of its own. Session-only and never saved — see CardBlockData's
   * own doc comment. Revoked on the next pick and on unmount, since an object
   * URL otherwise pins the file in memory for the life of the tab.
   */
  const [sampleImageUrl, setSampleImageUrl] = useState<string | null>(null);
  useEffect(() => {
    return () => {
      if (sampleImageUrl) URL.revokeObjectURL(sampleImageUrl);
    };
  }, [sampleImageUrl]);
  const onSampleImage = useCallback(
    (file: File) => setSampleImageUrl(URL.createObjectURL(file)),
    [],
  );

  /*
   * How many chips the canvas draws the sample's tags as. `null` is its own.
   *
   * Here for `sampleImageUrl`'s reason and on its terms: session-only, never
   * written to `draft`, never sent to the server, and `CardView` — the live
   * popup, and the shape the embed is checked against — never receives it. A
   * real card shows every tag its location wears; this only changes what is
   * being *looked at* while a layout is arranged, which is the one thing the
   * Tags block could not be checked against before (lib/card/preview-chips.ts).
   *
   * **It starts at a count rather than at `null` on a map with no locations**,
   * and that is the whole of how the stand-in gets tags. `SAMPLE_PLACE` carries
   * none of its own on purpose — a fresh map has no tag vocabulary for an
   * invented id to resolve against, and a chip with a made-up colour in front
   * would paint the sample pin a colour the map has never heard of. So the tags
   * come from the mechanism already built for exactly this, whose stand-ins are
   * colourless and carry ids no `newTagId` can mint. `null` the moment there is
   * a real location, because then the honest answer is that location's own
   * tags. Either way the control still sets it; this is only where it opens.
   */
  const [chipPreview, setChipPreview] = useState<number | null>(
    places.length === 0 ? SAMPLE_CHIP_COUNT : null,
  );

  /**
   * A colour to put under the card for as long as somebody is looking at it —
   * `chipPreview`'s twin, and null means the sample location's own.
   *
   * It exists because a card's colours come from the pin: the Logo block draws
   * one, and a Button nobody has coloured takes the pin's colour for its ground
   * (`buttonStyleOf`). So one design is a blue card on one group of locations
   * and a red one on the next, and this canvas can only ever draw whichever
   * location it picked. **It writes nothing** — see `PinColorPreview`, and
   * `CardBlockData.pinColor` for where it lands.
   */
  const [pinPreview, setPinPreview] = useState<string | null>(null);

  const isDirty = !sameCardLayout(draft, baseline);

  /**
   * The one place the server is told anything.
   *
   * `draft` is read at press time rather than closed over, so the button cannot
   * save a layout that is one gesture out of date — which it would be for the
   * whole of any render where a drop and the press land in the same frame.
   */
  const onSave = useCallback(() => {
    const layout = draft;

    updateCardDesign.mutate(layout, {
      // The action keeps its name through the flow (§8): the button says Save
      // changes, the toast says Saved.
      onSuccess: () => {
        setBaseline(layout);
        toast.success("Saved", {
          description: "Every map in your account uses this card now.",
        });
      },
      onError: (error) => toastError(error, "Couldn't save the card."),
    });
  }, [draft, updateCardDesign]);

  /**
   * A draft is worth one confirmation before it is thrown away.
   *
   * Only while there is something to lose — a listener that always fires turns
   * every navigation away from a card nobody touched into a dialog, which is how
   * people learn to click through them.
   */
  useEffect(() => {
    if (!isDirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [isDirty]);

  /** Change what is on screen. Nothing leaves the page until Save. */
  const commit = useCallback((layout: CardLayout) => {
    setDraft(layout);
  }, []);

  /*
   * Clear the card back to nothing.
   *
   * Lifted out because it is drawn twice: beside the panel's heading at `lg`,
   * and in the sheet's peek strip below it, where that heading is hidden. One
   * of the two is always `display: none`, so nothing is offered twice — but
   * both have to do the same thing, and a second copy of the body is how that
   * stops being true.
   */
  const resetCard = useCallback(() => {
    setSelectedId(null);
    commit(emptyCardLayout());
  }, [commit]);

  /*
   * Worked out here, not inside a `setDraft` updater, and that is the fix for a
   * real bug rather than a tidy-up.
   *
   * An updater has to be pure, and this one could not be: `makeCardBlock` gives
   * the new block a random id, and `select` schedules a render-phase update, so
   * React re-ran the updater and minted a *second* id. The layout that got
   * committed held one of them and `setSelectedId` had been handed the other,
   * so `findBlock` missed and the Modify tab opened onto the card's own
   * properties instead of the block that had just been dropped.
   *
   * `draft` in the dependency list is fine: this only ever fires from a
   * `pointerup`, so there is no burst of drops to batch against each other.
   */
  const onDrop = useCallback(
    (dragged: CardDrag, target: CardDropTarget) => {
      const next = dropCardBlock(draft, dragged, target);
      // Null is a drop that changes nothing — a block put back where it was, or
      // one a zone would not have taken. Neither is worth a write.
      if (!next) return;

      setDraft(next);

      // Select what just landed, so its controls are already open — whether it
      // came off the palette or was moved from somewhere else on the card.
      const landed =
        dragged.kind === "new"
          ? next.zones[target.zone][target.index]?.id
          : dragged.id;
      if (landed) select(landed);

      /*
       * And let it drop into place — a block off the palette *and* one moved
       * across the card.
       *
       * A move used to be left out, because its own `layoutId` glided it from
       * where it was and a bounce on top would be two arrivals for one gesture.
       * That stopped being true when the drag started pulling the copy onto its
       * slot (components/groups/ghost-magnet.ts): at release the copy is already
       * sitting where the block lands, so a glide in from the block's old place
       * would be a second block crossing the card towards the first. The flag
       * now also turns that glide off for this one block (`movingBlockTravel`),
       * and the bounce is the whole arrival. The Position control does not come
       * through here, so it still glides.
       *
       * Cleared on a timer rather than on the animation's end, because the
       * element that plays it is several components down and the flag has to
       * stop being true for the *next* render of this block whatever happens to
       * it — a re-pair rebuilds its row, and a block still marked as landing
       * would bounce a second time. The timer is the effect below, not a
       * `setTimeout` here.
       */
      if (landed) setJustLanded({ id: landed, isNew: dragged.kind === "new" });
    },
    [draft, select],
  );

  /*
   * The landing's clock starts when the landing is *drawn*, not when the drop
   * happened.
   *
   * It used to start in `onDrop`, and measured in the browser the commit a drop
   * causes — the new layout, the selection, the Modify tab mounting — took 277ms
   * in development before the first frame of the bounce. A window opened at the
   * release therefore closed with the bounce half played: the block was
   * switched to `rest` mid-squash and the impact ring unmounted at 60% opacity.
   * An effect runs after that commit, which is when Motion starts the animation.
   *
   * A new landing replaces the timer rather than racing it: the cleanup cancels
   * the last one, where a stale timeout comparing ids would clear a second drop
   * of the same block early.
   */
  useEffect(() => {
    if (!justLanded) return;

    const timer = window.setTimeout(() => setJustLanded(null), LANDED_MS);
    return () => window.clearTimeout(timer);
  }, [justLanded]);

  /*
   * What the block in the hand would free, kept for the removal wall.
   *
   * A ref rather than state, and that is not an optimisation: `CardCanvas`
   * reports this on every pointer move, and holding it in state would re-render
   * the whole designer through each frame of a drag that is already measuring
   * the card.
   */
  const freedRef = useRef<VacatedSpace | null>(null);
  const onVacate = useCallback((freed: VacatedSpace | null) => {
    freedRef.current = freed;
  }, []);

  /**
   * A block deleted, and nothing else on the card moved.
   *
   * The space it was in goes to the line below it (`removeCardBlock`), measured
   * by the very gesture that is doing the deleting — the wall is only ever
   * reached by dragging, so there is always an answer in hand. Cleared straight
   * afterwards, because a measurement outlives its gesture by nothing.
   */
  const onRemove = useCallback((id: string) => {
    const freed = freedRef.current;
    freedRef.current = null;

    setSelectedId((current) => (current === id ? null : current));
    setDraft((current) => removeCardBlock(current, id, freed ?? undefined));
  }, []);

  /*
   * `isDone` is the handle telling us the pointer has been released. It used to
   * be what decided when to write to the server; the draft is local now, so the
   * distinction has nothing left to do here and the parameter is kept only
   * because `BlockResizeHandle` passes it.
   */
  const onResize = useCallback((id: string, patch: BlockResize) => {
    setDraft((current) => resizeCardBlock(current, id, patch));
  }, []);

  /*
   * First with a photo, so a card built with a gallery block already has
   * something to show — falling back to the first location rather than none, so
   * a map with no photos yet still gets a real sample.
   *
   * `ownSample` is that real location or null; `sample` is what the canvas
   * draws, which on a map with no locations at all is the stand-in in
   * lib/card/sample-place.ts. The two are separate because one control cares
   * which it is: the Logo panel can *upload* to the location it names, and
   * uploading to a frozen constant is not a thing. `logoSample` below keeps
   * `ownSample`, so on an empty map that control correctly offers nothing.
   */
  const ownSample = places.find((place) => place.photoUrl) ?? places[0] ?? null;
  const sample = ownSample ?? SAMPLE_PLACE;
  const isSample = ownSample === null;

  /*
   * The sample's tags as the canvas will draw them, and whether its pin has a
   * logo on it at all.
   *
   * Both are facts about the sample rather than about the design, which is why
   * they are worked out here — this is the only component that knows which
   * location the canvas is drawing. `logoHasImage` is what lets the Logo panel
   * say which case a mark drawing nothing is in — a location whose pin carries a
   * glyph and which has uploaded no logo of its own — rather than leaving an
   * empty block unexplained (`LogoProperties`). The sample itself goes down too,
   * because that panel can upload one.
   */
  const tagChips = useMemo(
    () =>
      sample
        ? previewChips(tagChipsOf(initialMap.tagGroups, sample.tags), chipPreview)
        : [],
    [initialMap.tagGroups, sample, chipPreview],
  );

  /*
   * What the sample location's pin is actually wearing, which is what the canvas
   * draws until somebody sets a preview colour and what clearing one returns to.
   *
   * Two rungs of the ladder and not three: a **group** is the one this tool
   * cannot see, because the designer is account-level and a group is a fact
   * about one map's locations. That is exactly the gap `pinPreview` above fills
   * by hand, and it is why the control exists at all rather than being an
   * oversight worth fixing here.
   *
   * `tagChips` rather than the sample's raw tags, so a map with no locations
   * reads the same colourless stand-ins the chips do — an invented colour here
   * would paint the sample pin something the map has never heard of.
   */
  const samplePinColor = useMemo(
    () =>
      resolvePin(sample?.icon ?? "", initialMap.pinIcons)?.color ??
      pinColorOfChips(tagChips),
    [sample, initialMap.pinIcons, tagChips],
  );

  const logoHasImage = useMemo(
    () => Boolean(resolvePin(sample?.icon ?? "", initialMap.pinIcons)?.image),
    [sample?.icon, initialMap.pinIcons],
  );

  return (
    <RowDragProvider>
      {/*
       * **One definite height, and everything below divides it up.**
       *
       * The same rule `map-editor.tsx` documents at length, and it is here for
       * the same reason: every step from `<body>` down is `min-h-*` or `flex-1`
       * — a floor or a ratio, never a ceiling — so a panel whose contents grow
       * grows the page instead of scrolling. In this screen that showed up as
       * the card *moving*: the sidebar is taller with a block selected than
       * without one, and a grid row sized by its tallest cell passed that
       * straight to the column the card is centred in. Clicking a block, or
       * switching between Elements and Modify, re-centred the card underneath
       * the pointer.
       *
       * `flex-none` is what makes the height apply at all. This is a flex item
       * of `Container`, which is a column, so its height is its main size — and
       * `flex-1` sets `flex-basis: 0%`, which beats `height` there.
       *
       * **The height is unconditional now**, where it used to be `lg:` only. The
       * sidebar was in flow below `lg` and the page was allowed to grow to hold
       * a 440px card stacked on a column of controls; it is a bottom sheet over
       * the card at those widths, so there is nothing left to stack and the
       * canvas claims the rest. The two numbers are the editor's, exactly: 3rem
       * is `Container`'s own `py-6`, and 6.5rem adds the 3.5rem `MobileHeader`,
       * which is `md:hidden` and so contributes nothing above `md`.
       */}
      <div
        className="flex h-[calc(100dvh-3rem)] min-h-0 flex-none flex-col gap-3 max-md:h-[calc(100dvh-6.5rem)]"
        /* The map's accent, so a Button nobody gave a Background is drawn in
           the colour it will be drawn in on the published map rather than in
           the dashboard's own. See `cardAccentVars`. */
        style={cardAccentVars(initialMap.settings)}
      >
        {/* Filling the row is what makes the two columns share one viewport
            height at `lg`; below it there is one column, and the sheet is out of
            flow over the top of it. */}
        {/* 24rem and not 20: the sidebar holds a two-column palette of chips
            and a column of sliders, colour fields and segmented rows, and at
            20rem every one of them was at its floor — palette labels truncating
            after a word, "The block above" clipped inside its button, a colour
            field with no room beside it for a reset. 23rem cleared the labels
            and no more: the Modify tab still overflowed sideways, and its own
            scrollbar was taking the last of the margin. The extra 16px here and
            the reserved gutter in `DesignerTabPanel` are one fix in two places.
            `app/(dashboard)/maps/[id]/card/loading.tsx` repeats this number. */}
        {/* Below `lg` this row is the sheet's containing block, and both of the
            classes that make it one are load-bearing. `relative`, or the sheet
            positions itself against the viewport instead. And
            `max-lg:overflow-hidden`, because two thirds of the sheet hangs below
            the frame while it is shut — an absolutely positioned box past the
            bottom of the page grows the document and brings the window's
            scrollbar in with it. The editor row carries the same pair for the
            same reason.

            `max-lg:flex-1` with a single 1fr row: the panel is out of flow there
            and the card is the only thing in here, so it should have the screen
            rather than sit in the top half of it. */}
        <div className="relative grid min-h-0 gap-4 max-lg:flex-1 max-lg:grid-rows-[minmax(0,1fr)] max-lg:overflow-hidden lg:flex-1 lg:grid-cols-[minmax(0,1fr)_24rem]">
          {/* Nothing but a block itself stops the deselect from firing — see
              DesignerBlock's own onClick. */}
          <DesignerCanvasArea
            // What the removal strip is positioned against — the card is
            // centred in this box, so its own width is where its right edge is,
            // and its height is the height the strip matches.
            cardWidth={draft.width}
            cardHeight={draft.maxHeight}
            // Absent is opaque, here as everywhere else it is read.
            isTranslucent={(draft.backgroundOpacity ?? 100) < 100}
            onBackdropClick={() => setSelectedId(null)}
            onRemove={onRemove}
          >
            {/* One child, so the caption travels with the card rather than
                beside it: `DesignerCanvasArea` centres its children in a flex
                *row*, and a `<p>` dropped in as a second child would sit next
                to the card and push it off centre. A column keeps the two as
                one centred unit at every height, which an absolutely
                positioned caption would not — the box can be shorter than a
                440px card, and `bottom-0` would then be printed across it.

                Safe to wrap because nothing here measures the card against its
                parent: every rect in `use-drop-bands.ts` is
                `getBoundingClientRect`, and the removal strip is positioned
                from the `cardWidth`/`cardHeight` props above rather than from
                the DOM. */}
            <div className="flex flex-col items-center gap-2">
              <CardCanvas
                /* The map's own light/dark, so the card being designed is
                   the card a visitor gets — see `cardThemeClass`. */
                theme={cardThemeClass(initialMap.style, prefersDark, draft)}
                layout={draft}
                place={sample}
                tagChips={tagChips}
                fields={initialMap.fields}
                /* The sample's own colour, or the one the Preview fold has been
                   set to — see `pinPreview`. */
                pinColor={pinPreview ?? samplePinColor}
                pinIcons={initialMap.pinIcons}
                selectedId={selectedId}
                justLanded={justLanded}
                onSelect={selectOnCanvas}
                onDrop={onDrop}
                onVacate={onVacate}
                onResize={onResize}
                sampleImageUrl={sampleImageUrl}
                onSampleImage={onSampleImage}
              />

              {/* Said only when it is true, and said under the card rather than
                  in place of it. This used to be the whole of what an empty map
                  got — "add a location first" — which turned the one screen for
                  looking at a card into a screen with no card on it. The card
                  is real now and the sentence is a caption, so nobody designs
                  believing the address on it is theirs. */}
              {isSample ? (
                <p className="max-w-[var(--card-w)] text-center text-xs text-muted">
                  An example location — add your own and the card draws those
                  instead.
                </p>
              ) : null}
            </div>
          </DesignerCanvasArea>

          {/* The panel itself is built inside `CardDesignerTabs` — the tab strip
              lives in its header, and React Aria needs one context around the
              strip and the panels both. Everything the section wears is passed
              through from here; `DesignerSidePanel` only decides where on the
              screen the whole of it sits. */}
          <DesignerSidePanel
            isOpen={isPanelOpen}
            onOpenChange={setPanelOpen}
            /*
             * What the shut sheet says, and it is the panel's heading moved
             * rather than a second one invented: below `lg` the tab strip and
             * the header row are inside the part that is shut, so the strip has
             * to carry the open tab's name, the unsaved dot and the two controls
             * that act on the whole design.
             */
            peek={
              <>
                <h2 className="flex min-w-0 items-center text-sm font-semibold text-foreground">
                  {TAB_TITLES[activeTab]}
                  {isDirty ? <UnsavedDot /> : null}
                </h2>

                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    label="Reset card"
                    icon={RotateCcw}
                    onPress={resetCard}
                  />
                  {/* The way back out. Escape does it too, and so does the rail
                      above; this is the one a thumb can reach without leaving
                      the controls. */}
                  <IconButton
                    label="Close panel"
                    icon={X}
                    onPress={() => setPanelOpen(false)}
                  />
                </div>
              </>
            }
          >
            <CardDesignerTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              // Reset stays beside the title, where it has always been: it is the
              // section's own secondary control, and it is a draft edit like any
              // other — an accidental press is undone by walking away rather than
              // by a confirmation. This row is `max-lg:hidden`; the sheet's peek
              // strip carries the same control below that.
              action={
                <IconButton
                  label="Reset card"
                  icon={RotateCcw}
                  onPress={resetCard}
                />
              }
              // Which is what the Elements tab's dot is drawn from — see there.
              isDirty={isDirty}
              /*
               * Save goes under the controls, not beside the title — and on the
               * **Elements** tab only.
               *
               * `footer` is a sibling of the panel's body rather than a child of
               * it, and the body is the scroller (`lg:flex-1 lg:min-h-0`), so it
               * stays on screen however far someone has scrolled. What it also
               * did was take a footer's worth of height off the Modify tab, which
               * is the one that needs it: a block with text and chips now draws
               * six groups of controls in a 24rem column, and Save is not one of
               * them — it is a decision about the whole design, which is what the
               * Elements tab is already about.
               *
               * The cost is that Save is one tab away while a block is selected,
               * and `isDirty` above is what pays it: the strip carries a dot, and
               * this button is dead until there is something for it to do.
               */
              footer={
                activeTab === "elements" ? (
                  <Button
                    size="sm"
                    onPress={onSave}
                    isPending={updateCardDesign.isPending}
                    // Dead while there is nothing to save, which is also what
                    // tells someone at a glance that their last change landed.
                    isDisabled={!isDirty}
                  >
                    Save changes
                  </Button>
                ) : null
              }
              elementsPanel={<BlockPalette layout={draft} />}
              modifyPanel={
                <CardProperties
                  layout={draft}
                  selectedId={selectedId}
                  logoHasImage={logoHasImage}
                  logoSample={ownSample}
                  mapId={initialMap.id}
                  fields={initialMap.fields}
                  chipPreview={chipPreview}
                  onChipPreview={setChipPreview}
                  pinPreview={pinPreview ?? samplePinColor}
                  samplePinColor={samplePinColor}
                  onPinPreview={setPinPreview}
                  onCard={(patch) => commit({ ...draft, ...patch })}
                  onBlock={(id, patch) => commit(resizeCardBlock(draft, id, patch))}
                  /*
                   * Through `dropCardBlock` and not a hand-written splice, on the
                   * rule the per-pin menu already follows for patches: it is the
                   * same function the drag ends in, so this inherits `acceptsBlock`
                   * and every clamp behind it rather than growing a second opinion
                   * about where a block may go.
                   *
                   * It lands at the end of the band it is sent to, with `offset: 0`
                   * — a stored lead is empty space *above* a block, and the whole
                   * reason for sending one to the bottom band is that it should
                   * hang off the card's own edge rather than off whatever happens
                   * to be above it. Null is a move the layout refused; there is
                   * nothing to write for it.
                   */
                  onMoveBlockZone={(id, zone) => {
                    const next = dropCardBlock(
                      draft,
                      { kind: "move", id },
                      { zone, index: draft.zones[zone].length, offset: 0 },
                    );
                    if (next) commit(next);
                  }}
                />
              }
            />
          </DesignerSidePanel>
        </div>
      </div>
    </RowDragProvider>
  );
}
