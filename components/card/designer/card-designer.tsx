"use client";

import { Button, toast } from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cardAccentVars } from "@/components/card/card-frame";
import { cardThemeClass } from "@/lib/card/card-theme";
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
  emptyCardLayout,
  isSavedCardLayout,
  type CardLayout,
} from "@/packages/shared/card-layout";
import { resolvePin } from "@/packages/shared/pin-icons";
import { tagChipsOf } from "@/packages/shared/tags";
import { previewChips } from "@/lib/card/preview-chips";
import { BlockPalette } from "./block-palette";
import type { BlockResize } from "./block-resize-handle";
import { CardCanvas } from "./card-canvas";
import { CardDesignerTabs, type DesignerTab } from "./card-designer-tabs";
import { DesignerCanvasArea } from "./designer-canvas-area";
import { CardProperties } from "./properties/card-properties";

/**
 * How long a landing block is marked as landing, in ms.
 *
 * The 150ms every transition in the app runs at, plus a frame — see `TRANSITION`
 * in components/ui/list-row-motion.ts. It is a flag being cleared rather than an
 * animation being stopped, so erring long costs nothing and erring short would
 * cut the settle off halfway.
 */
const LANDED_MS = 200;

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
  const { data: design = initialCardDesign } = useCardDesign(initialCardDesign);
  const updateCardDesign = useUpdateCardDesign();

  /*
   * "Never touched" and "the untouched default" are different fallbacks on
   * purpose. A live, unconfigured site still publishes the classic populated
   * card (defaultCardLayout, via resolveCardLayout) — that contract does not
   * change here. But this screen is where someone *designs* a card, and
   * opening it onto a card already half-built by nobody is confusing, not
   * helpful — so the designer's own starting canvas is blank instead.
   */
  const saved = useMemo(
    () =>
      isSavedCardLayout(design) ? readCardLayout(design) : emptyCardLayout(),
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
   * The block that arrived from the palette on the last drop, while its settle
   * animation is still playing. Null the rest of the time, which is nearly all
   * of it. See `landedBlockMotion` and the note in `onDrop`.
   */
  const [justLanded, setJustLanded] = useState<string | null>(null);

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
   */
  const [chipPreview, setChipPreview] = useState<number | null>(null);

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
       * And, for a block that came off the palette, let it settle into place.
       *
       * Only for a new one: a block being moved is already on the card, so its
       * own `layoutId` glides it from where it was, and a scale on top of that
       * would be two arrivals for one gesture.
       *
       * Cleared on a timer rather than on the animation's end, because the
       * element that plays it is several components down and the flag has to
       * stop being true for the *next* render of this block whatever happens to
       * it — a re-pair rebuilds its row, and a block still marked as landing
       * would pop a second time. The delay is the transition's own 150ms with a
       * frame's slack, and a stale timer is harmless: it only ever clears.
       */
      if (dragged.kind === "new" && landed) {
        setJustLanded(landed);
        window.setTimeout(() => {
          setJustLanded((current) => (current === landed ? null : current));
        }, LANDED_MS);
      }
    },
    [draft, select],
  );

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

  // First with a photo, so a card built with a gallery block already has
  // something to show — falling back to the first location rather than none,
  // so a map with no photos yet still gets a real sample.
  const sample = places.find((place) => place.photoUrl) ?? places[0] ?? null;

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
       * `lg:flex-none` is what makes the height apply at all. This is a flex
       * item of `Container`, which is a column, so its height is its main size —
       * and `flex-1` sets `flex-basis: 0%`, which beats `height` there. Below
       * `lg` the columns stack and it goes back to `flex-1`: a phone cannot show
       * a 440px card and a properties panel at once, so that page scrolls, as
       * the editor's does.
       *
       * `100dvh - 3rem` is exact rather than approximate — 3rem is `Container`'s
       * own `py-6`, and at `lg` there is nothing else above this.
       */}
      <div
        className="flex min-h-0 flex-1 flex-col gap-3 lg:h-[calc(100dvh-3rem)] lg:flex-none"
        /* The map's accent, so a Button nobody gave a Background is drawn in
           the colour it will be drawn in on the published map rather than in
           the dashboard's own. See `cardAccentVars`. */
        style={cardAccentVars(initialMap.settings)}
      >
        <p className="shrink-0 text-xs text-muted">
          This card design applies to every map in your account — changes here
          change what visitors see everywhere, not just on this one.
          {isDirty ? " You have unsaved changes." : null}
        </p>

        {/* `lg:flex-1` and not `flex-1`: filling the row is what makes the two
            columns share one viewport height, and below `lg` there is only one
            column — stretching it there would squeeze a 440px card and a
            properties panel into a phone screen and make both scroll inside
            themselves instead of letting the page scroll past them. */}
        {/* 24rem and not 20: the sidebar holds a two-column palette of chips
            and a column of sliders, colour fields and segmented rows, and at
            20rem every one of them was at its floor — palette labels truncating
            after a word, "The block above" clipped inside its button, a colour
            field with no room beside it for a reset. 23rem cleared the labels
            and no more: the Modify tab still overflowed sideways, and its own
            scrollbar was taking the last of the margin. The extra 16px here and
            the reserved gutter in `DesignerTabPanel` are one fix in two places.
            `app/(dashboard)/maps/[id]/card/loading.tsx` repeats this number. */}
        <div className="grid min-h-0 gap-4 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_24rem]">
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
            {sample ? (
              <CardCanvas
                /* The basemap's light/dark, so the card being designed is the
                   card a visitor gets — see `cardThemeClass`. */
                theme={cardThemeClass(initialMap.style)}
                layout={draft}
                place={sample}
                tagChips={tagChips}
                fields={initialMap.fields}
                pinIcons={initialMap.pinIcons}
                selectedId={selectedId}
                justLanded={justLanded}
                onSelect={select}
                onDrop={onDrop}
                onVacate={onVacate}
                onResize={onResize}
                sampleImageUrl={sampleImageUrl}
                onSampleImage={onSampleImage}
              />
            ) : (
              <p className="max-w-xs text-center text-sm text-muted">
                Add a location first — the card is drawn from a real one, so
                you can see what it will actually look like.
              </p>
            )}
          </DesignerCanvasArea>

          {/* The panel itself is built inside `CardDesignerTabs` — the tab strip
              lives in its header, and React Aria needs one context around the
              strip and the panels both. Everything the section wears is passed
              through from here. */}
          <CardDesignerTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            // Reset stays beside the title, where it has always been: it is the
            // section's own secondary control, and it is a draft edit like any
            // other — an accidental press is undone by walking away rather than
            // by a confirmation.
            action={
              <IconButton
                label="Reset card"
                icon={RotateCcw}
                onPress={() => {
                  setSelectedId(null);
                  commit(emptyCardLayout());
                }}
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
             * the line above the card still says it in words.
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
                logoSample={sample}
                mapId={initialMap.id}
                fields={initialMap.fields}
                chipPreview={chipPreview}
                onChipPreview={setChipPreview}
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
        </div>
      </div>
    </RowDragProvider>
  );
}
