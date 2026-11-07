"use client";

import { Button, ScrollShadow, Tooltip } from "@heroui/react";
import { ChevronLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StorefrontStepper } from "@/components/shopify/storefront/storefront-stepper";
import { useStorefront } from "@/components/shopify/storefront/use-storefront";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ErrorMessage } from "@/components/ui/error-message";
import { HeightCollapse } from "@/components/ui/height-collapse";
import { PropertyFold } from "@/components/ui/properties/property-fold";
import type { AppMap, Place, Shape } from "@/lib/repositories/types";
import { hasUnpublishedChanges } from "@/lib/snapshot/staleness";
import { PublishStatus } from "../publish-status";
import { DeviceToggle } from "../preview-device/device-toggle";
import type { DeviceId } from "../preview-device/devices";
import { WebsiteStepper } from "../website/website-stepper";
import { ColorsGroup } from "./colors-group";
import { LanguageGroup } from "./language-group";
import { MapControlsGroup } from "./map-controls-group";
import { MeasurementGroup } from "./measurement-group";
import { DesignFolds, FoldingFooter, useOpenFoldStore } from "./open-fold";
import { useTurnOnAnalytics } from "./use-turn-on-analytics";
import { PanelGroup } from "./panel-group";
import { PanelSurfaceGroup } from "./panel-surface-group";
import { RowsGroup } from "./rows-group";
import type { EmbedDesign } from "./use-embed-design";

/**
 * The designer beside the map: everything a visitor will see, and the button
 * that makes it real.
 *
 * **This column stands where the app nav does on every other page.** The nav is
 * hidden here (`lib/layout/app-nav.ts`), so the page is one column of controls
 * and one map, edge to edge — which is what makes it read as a designer rather
 * than a form with a picture beside it, and what leaves the preview wide enough
 * to draw the desktop layout a visitor actually gets. The consequence is that
 * the back link in the header is the only way out, so it is structure rather
 * than decoration.
 *
 * `design` comes from the parent rather than from a `useEmbedDesign` call here:
 * the preview needs the same draft, and `settings` is a single JSON column that
 * `updateMap` serialises whole, so two hooks writing it would be the lost update
 * CLAUDE.md §6 records.
 *
 * The preview repaints from these controls because it is the real embed reading
 * a snapshot built in the browser — so what is on the left is not an impression
 * of the published map, it is the published map. Most controls no longer rebuild
 * it at all; see components/preview/embed-preview.tsx.
 *
 * **Below `lg` the column is a bottom sheet over the map** — the same box the
 * editor's locations panel and the card designer's sidebar are
 * (`components/ui/bottom-sheet.tsx`). It used to be a `max-h-[60dvh]` block
 * stacked under a `55dvh` map with the page scrolling past both, which is a
 * designer where neither half has room and neither can be seen while the other
 * is used. Shut, the strip says whether there is anything to publish; open, the
 * controls take the frame and the preview is still the band above them.
 *
 * The consequence to know: **Publish is one tap away** below `lg` rather than on
 * screen — a footer in the peek would be a second row of chrome on the one
 * width that has none to spare.
 *
 * **The way out is a stepper either way**: "Your store" inside the Shopify admin
 * (`StorefrontStepper`), "Your website" everywhere else (`WebsiteStepper`).
 * Same steps component, same placement, same one-button-at-a-time rule.
 *
 * **It is pinned under the folds at every width, and folds away while one is
 * open** (the owner's request, 2026-11-07). Opening a fold slides the steps
 * down to their heading row — "Your website · ● Live" — on the accordion's own
 * curve and in the same frame (`HeightCollapse`), so the fold gets the room;
 * closing it, or pressing that row, brings them back. Phones used to get the
 * stepper at the top of the scroller instead, because pinned it filled the
 * sheet and left the folds no room (2026-11-01) — folding away is what answers
 * that, so there is one placement and one copy of it again.
 */
export function DesignSidebar({
  map,
  places,
  shapes,
  design,
  device,
  onDeviceChange,
  turnOnAnalytics = false,
  isShopify = false,
}: {
  map: AppMap;
  places: Place[];
  shapes: Shape[];
  design: EmbedDesign;
  /** Which width the preview is capped to. Local to the page, never published
      — see `PublishPanel`. */
  device: DeviceId;
  onDeviceChange: (value: DeviceId) => void;
  /** Open on the Visitor analytics fold with the switch on — see `useTurnOnAnalytics`. */
  turnOnAnalytics?: boolean;
  /** Inside the Shopify admin — the stepper is "Your store" rather than "Your
      website". From the server's user, so the column never draws the other
      one first. */
  isShopify?: boolean;
}) {
  const isEmpty = places.length === 0 && shapes.length === 0;
  const hasPendingChanges = hasUnpublishedChanges(map, places, shapes);
  // Inert outside the Shopify admin. Here rather than in the stepper because
  // it needs `hasPendingChanges`, which this column already works out.
  const storefront = useStorefront(map.id, {
    enabled: isShopify,
    hasPendingChanges,
    published: Boolean(map.publishedAt),
  });

  // Shut to start with, which only means anything below `lg`: the map is what
  // this page is for, and the controls are one tap from it. Open when the
  // owner came here to switch analytics on — the switch is the point then.
  const [isOpen, setIsOpen] = useState(turnOnAnalytics);

  // Which design fold is open — shared by the folds and the footer, because
  // any open fold folds the steps away and the stepper's heading closes it
  // again. A store rather than state here; see `open-fold.tsx` for the
  // measurement that decided it.
  const openFold = useOpenFoldStore(turnOnAnalytics ? "measurement" : null);

  useTurnOnAnalytics(turnOnAnalytics, design);

  // A map carrying only shapes publishes something real, so this waits until
  // there is genuinely nothing to put on a customer's site.
  const emptyNotice = (isCollapsed: boolean) =>
    isEmpty ? (
      <HeightCollapse isCollapsed={isCollapsed} className="pb-3">
        <p className="text-xs text-muted">
          This map has no locations yet, so it would publish empty. Add some on
          the Locations tab first.
        </p>
      </HeightCollapse>
    ) : null;

  // The path onto the store or the site, as numbered steps
  // (docs/notes/shopify.md, "The Publish footer inside Shopify";
  // docs/notes/publish-and-embed.md, "The Your website stepper").
  const stepper = (fold: { isCollapsed: boolean; onExpand: () => void }) =>
    isShopify ? (
      <StorefrontStepper
        map={map}
        places={places}
        hasPendingChanges={hasPendingChanges}
        storefront={storefront}
        {...fold}
      />
    ) : (
      <WebsiteStepper
        map={map}
        places={places}
        hasPendingChanges={hasPendingChanges}
        {...fold}
      />
    );

  return (
    <BottomSheet
      contentId="design-sheet-content"
      label="Design"
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      /*
       * What the shut strip says. The name, because with the app nav gone this
       * column is the only thing telling anyone what it is — and the publish
       * state, because "is there anything unpublished?" is the one question
       * worth answering without opening anything. The footer's own copy is
       * `max-lg:hidden`, so it is said once at either width.
       */
      peek={
        <>
          <h2 className="truncate text-sm font-semibold text-foreground">
            Design
          </h2>
          <PublishStatus
            form="compact"
            map={map}
            hasPendingChanges={hasPendingChanges}
          />
        </>
      }
      // No `lg` form: up there this panel has its own header row, and a second
      // title above it would be the column naming itself twice.
      peekClassName="lg:hidden"
      className="order-2 max-lg:rounded-t-xl max-lg:border max-lg:border-border lg:order-1 lg:w-80 lg:shrink-0 lg:border-r lg:border-border"
    >
      <header className="flex min-h-14 shrink-0 items-center gap-1 border-b border-border px-2">
        {/* The nav is gone on this page, so this is the way back.

            It used to carry the map's name, on the argument that the one thing
            worth confirming on a full-bleed page with no chrome is which map you
            are designing. That is still worth confirming and it is still here —
            as the link's accessible name and its tooltip — but it is no longer
            worth a truncating half of a 20rem header row. The width it was
            spending is what the preview-width tiles now sit in. */}
        <Tooltip delay={0}>
          <Link
            href={`/maps/${map.id}`}
            aria-label={`Back to ${map.name}`}
            className="flex shrink-0 items-center rounded-lg p-1.5 text-foreground hover:bg-default"
          >
            <ChevronLeft aria-hidden="true" className="size-4 text-muted" />
          </Link>
          <Tooltip.Content placement="bottom">{map.name}</Tooltip.Content>
        </Tooltip>

        {/* Between the two controls that are about the page rather than about
            the map. `flex-1` so it centres in whatever the chevron and Reset
            leave, and `min-w-0` so it is the tiles that give way first if a
            long-labelled Reset ever needs the room. */}
        <div className="flex min-w-0 flex-1 justify-center">
          <DeviceToggle value={device} onChange={onDeviceChange} />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onPress={design.reset}
          aria-label="Reset the design to the defaults"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Reset
        </Button>
      </header>

      <ScrollShadow className="min-h-0 flex-1 px-3 py-2" hideScrollBar>
        {design.error ? (
          <div className="pb-3">
            <ErrorMessage error={design.error} />
          </div>
        ) : null}

        {/*
          A full-height column holding seven unrelated questions — where the
          panel goes, what it is made of, what a row says, what is on the map,
          what colour it all is, what language it speaks, and whether visitors
          are counted — so a wall of thirty controls is one nobody reads down.

          Seven because "Results panel" had grown to eleven controls with
          switches at positions 1, 3, 10 and 11, which is the wall again inside
          one fold. Two of them were never panel controls and are in "Map
          controls" now, and the three describing the panel's *surface* are
          their own fold below. There was an eighth, "On a phone", holding the
          drawer switch; that and three other layout controls were retired on
          2026-11-07 (`RETIRED_CONTROLS` in embed-settings.schema.ts).

          It used to open on "Results panel" and allow several at once, the
          argument being that comparing a panel setting against a colour is a
          real thing to be doing. It is, and it lost to the more common case:
          five open folds in a 20rem column is the wall again. `PropertyFolds`
          is the one answer every panel in the app now gives.
        */}
        <DesignFolds store={openFold}>
          <PropertyFold id="panel" title="Results panel">
            <PanelGroup {...design} />
          </PropertyFold>

          {/* With the panel switched off this fold is not merely empty — it is
              a trigger that opens onto nothing, which is what `isEmpty` exists
              to remove. */}
          <PropertyFold
            id="surface"
            title="Panel surface"
            isEmpty={!design.settings.list}
          >
            <PanelSurfaceGroup {...design} />
          </PropertyFold>

          {/* Rows describe a panel that is not there when the panel is off. */}
          {design.settings.list ? (
            <PropertyFold id="rows" title="Result rows">
              <RowsGroup {...design} />
            </PropertyFold>
          ) : null}

          <PropertyFold id="controls" title="Map controls">
            <MapControlsGroup {...design} />
          </PropertyFold>

          <PropertyFold id="colors" title="Colours">
            <ColorsGroup {...design} />
          </PropertyFold>

          <PropertyFold id="language" title="Language">
            <LanguageGroup {...design} />
          </PropertyFold>

          {/* Last, because it is the only group that is not about how the map
              looks — and the only one whose consequences land on somebody other
              than the owner. See its own header. */}
          <PropertyFold id="measurement" title="Visitor analytics">
            <MeasurementGroup {...design} />
          </PropertyFold>
        </DesignFolds>
      </ScrollShadow>

      {/* Outside the scroller on purpose: a long column of controls must not be
          able to push Publish out of reach. At every width — while a fold is
          open it is just the heading row (`isCollapsed`), which is what keeps
          it from crowding a phone's sheet. Spacing lives inside the collapses,
          so a folded footer is the row and its padding and nothing else. */}
      <FoldingFooter
        store={openFold}
        className="shrink-0 border-t border-border px-3 py-3"
      >
        {(fold) => (
          <>
            {emptyNotice(fold.isCollapsed)}
            {stepper(fold)}
          </>
        )}
      </FoldingFooter>
    </BottomSheet>
  );
}
