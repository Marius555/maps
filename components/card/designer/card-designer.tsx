"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { RowDragProvider } from "@/components/groups/row-drag-context";
import { IconButton } from "@/components/ui/icon-button";
import { SectionPanel } from "@/components/ui/section-panel";
import { CARD_DESIGNER_ENABLED } from "@/lib/card/designer-status";
import {
  dropCardBlock,
  removeCardBlock,
  resizeCardBlock,
  type CardDrag,
  type CardDropTarget,
} from "@/lib/card/card-edits";
import { useCardDesign, useUpdateCardDesign } from "@/lib/query/card-design";
import { usePlaces } from "@/lib/query/places";
import { toastError } from "@/lib/query/toast-error";
import type { AppMap, Place } from "@/lib/repositories/types";
import { readCardLayout } from "@/lib/validation/card-layout.schema";
import {
  defaultCardLayout,
  emptyCardLayout,
  isSavedCardLayout,
  type CardLayout,
} from "@/packages/shared/card-layout";
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
 * Saving is per gesture, not per frame: a drop, a removal, or a handle released
 * is one PATCH, exactly the rule a shape's radius handle follows. The layout in
 * `draft` is what the canvas draws, so a handle held down repaints at 60fps while
 * the network sees one write.
 *
 * **While `CARD_DESIGNER_ENABLED` is false it saves nothing at all.** The tool is
 * unfinished and every map draws `defaultCardLayout()` instead
 * (lib/card/designer-status.ts), so this opens onto the card that is actually in
 * use and everything done to it is a sketch that dies with the page. The single
 * seam is `save` — every gesture goes through it, so there is one place to stop
 * rather than one per control, and no gesture can be added that quietly escapes.
 * The API refuses the write as well; a disabled control is a courtesy, not a
 * guarantee.
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
  const saved = useMemo(() => {
    // The card that is actually being drawn, so this page is a preview of the
    // real thing rather than a blank canvas nobody's map uses.
    if (!CARD_DESIGNER_ENABLED) return defaultCardLayout();

    return isSavedCardLayout(design) ? readCardLayout(design) : emptyCardLayout();
  }, [design]);

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

  const save = useCallback(
    (layout: CardLayout) => {
      // Nothing leaves the page while the tool is unfinished. Silently, because
      // the notice above the canvas has already said so and a toast per drag
      // would be repeating it forty times.
      if (!CARD_DESIGNER_ENABLED) return;

      updateCardDesign.mutate(layout, {
        onError: (error) => toastError(error, "Couldn't save the card."),
      });
    },
    [updateCardDesign],
  );

  /** Change what is on screen and tell the server, in that order. */
  const commit = useCallback(
    (layout: CardLayout) => {
      setDraft(layout);
      save(layout);
    },
    [save],
  );

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
      save(next);

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
    [draft, save, select],
  );

  const onRemove = useCallback(
    (id: string) => {
      setSelectedId((current) => (current === id ? null : current));
      setDraft((current) => {
        const next = removeCardBlock(current, id);
        if (next !== current) save(next);

        return next;
      });
    },
    [save],
  );

  const onResize = useCallback(
    (id: string, patch: BlockResize, isDone: boolean) => {
      setDraft((current) => {
        const next = resizeCardBlock(current, id, patch);
        // One PATCH, on release. A save per frame would be sixty writes for one
        // gesture — the same rule the shape handles follow.
        if (isDone) save(next);

        return next;
      });
    },
    [save],
  );

  // First with a photo, so a card built with a gallery block already has
  // something to show — falling back to the first location rather than none,
  // so a map with no photos yet still gets a real sample.
  const sample = places.find((place) => place.photoUrl) ?? places[0] ?? null;

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
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:h-[calc(100dvh-3rem)] lg:flex-none">
        <p className="shrink-0 text-xs text-muted">
          This card design applies to every map in your account — changes here
          change what visitors see everywhere, not just on this one.
        </p>

        {/* `lg:flex-1` and not `flex-1`: filling the row is what makes the two
            columns share one viewport height, and below `lg` there is only one
            column — stretching it there would squeeze a 440px card and a
            properties panel into a phone screen and make both scroll inside
            themselves instead of letting the page scroll past them. */}
        <div className="grid min-h-0 gap-4 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Nothing but a block itself stops the deselect from firing — see
              DesignerBlock's own onClick. */}
          <DesignerCanvasArea
            // What the removal strip is positioned against — the card is
            // centred in this box, so its own width is where its right edge is,
            // and its height is the height the strip matches.
            cardWidth={draft.width}
            cardHeight={draft.maxHeight}
            onBackdropClick={() => setSelectedId(null)}
            onRemove={onRemove}
          >
            {sample ? (
              <CardCanvas
                layout={draft}
                place={sample}
                category={categoryOf(initialMap, sample)}
                fields={initialMap.fields}
                pinIcons={initialMap.pinIcons}
                selectedId={selectedId}
                justLanded={justLanded}
                onSelect={select}
                onDrop={onDrop}
                onResize={onResize}
                sampleImageUrl={sampleImageUrl}
                onSampleImage={onSampleImage}
                onFit={commit}
              />
            ) : (
              <p className="max-w-xs text-center text-sm text-muted">
                Add a location first — the card is drawn from a real one, so
                you can see what it will actually look like.
              </p>
            )}
          </DesignerCanvasArea>

          <SectionPanel
            title="Blocks"
            description="Drag one onto the card. Only the places it can go will light up."
            // At `lg` the panel is a fixed-height column whose body scrolls,
            // rather than a box that grows with whichever tab is open — that is
            // what keeps the card still while the sidebar's contents change
            // under it. Below `lg` it is an ordinary panel and the page scrolls.
            className="flex flex-col lg:min-h-0 lg:overflow-hidden"
            bodyClassName="flex flex-col lg:min-h-0 lg:flex-1"
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
          >
            <CardDesignerTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              elementsPanel={<BlockPalette layout={draft} />}
              modifyPanel={
                <CardProperties
                  layout={draft}
                  selectedId={selectedId}
                  onCard={(patch) => commit({ ...draft, ...patch })}
                  onBlock={(id, patch) => commit(resizeCardBlock(draft, id, patch))}
                />
              }
            />
          </SectionPanel>
        </div>
      </div>
    </RowDragProvider>
  );
}

/** The category this location wears, if the map still defines it. */
function categoryOf(map: AppMap, place: Place) {
  return map.categories.find((category) => category.id === place.category);
}
