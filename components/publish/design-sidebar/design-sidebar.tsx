"use client";

import { Accordion, Button, ScrollShadow } from "@heroui/react";
import { ChevronLeft, RotateCcw } from "lucide-react";
import Link from "next/link";

import { ErrorMessage } from "@/components/ui/error-message";
import { PropertyFold } from "@/components/ui/properties/property-fold";
import type { AppMap, Place, Shape } from "@/lib/repositories/types";
import { hasUnpublishedChanges } from "@/lib/snapshot/staleness";
import { PublishAction } from "../publish-action";
import { PublishStatus } from "../publish-status";
import { ShareDialog } from "../share-dialog/share-dialog";
import { ColorsGroup } from "./colors-group";
import { MapControlsGroup } from "./map-controls-group";
import { MeasurementGroup } from "./measurement-group";
import { PanelGroup } from "./panel-group";
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
 */
export function DesignSidebar({
  map,
  places,
  shapes,
  design,
}: {
  map: AppMap;
  places: Place[];
  shapes: Shape[];
  design: EmbedDesign;
}) {
  const isEmpty = places.length === 0 && shapes.length === 0;

  return (
    <aside className="order-2 flex max-h-[60dvh] min-h-0 shrink-0 flex-col overflow-hidden border-t border-border bg-surface lg:order-1 lg:max-h-none lg:w-80 lg:border-t-0 lg:border-r">
      <header className="flex min-h-14 shrink-0 items-center gap-1 border-b border-border px-2">
        {/* The nav is gone on this page, so this is the way back. It carries the
            map's name rather than saying "Back", because the one thing worth
            confirming on a full-bleed page with no chrome is which map you are
            designing. */}
        <Link
          href={`/maps/${map.id}`}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-semibold tracking-tight text-foreground hover:bg-default"
        >
          <ChevronLeft aria-hidden="true" className="size-4 shrink-0 text-muted" />
          <span className="truncate">{map.name}</span>
        </Link>

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
          An accordion rather than the card designer's Modify panel's flat
          divided column, and the difference is the shape of the two. That one
          is a fixed-height tab about a single selected block, where folding
          buys height that was never scarce. This is a full-height column
          holding four unrelated questions — where the panel goes, what a row
          says, what is on the map, what colour it all is — and a wall of thirty
          controls is one nobody reads down. Multiple open at once, because
          comparing a panel setting against a colour is a real thing to be
          doing. (The card designer's *palette* folds for this reason too, and
          shares `PropertyFold` with it.)
        */}
        <Accordion allowsMultipleExpanded defaultExpandedKeys={["panel"]}>
          <PropertyFold id="panel" title="Results panel">
            <PanelGroup {...design} />
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

          {/* Last, because it is the only group that is not about how the map
              looks — and the only one whose consequences land on somebody other
              than the owner. See its own header. */}
          <PropertyFold id="measurement" title="Visitor analytics">
            <MeasurementGroup {...design} />
          </PropertyFold>
        </Accordion>
      </ScrollShadow>

      {/* Outside the scroller on purpose: a long column of controls must not be
          able to push Publish out of reach. */}
      <footer className="shrink-0 space-y-3 border-t border-border px-3 py-3">
        <PublishStatus
          map={map}
          hasPendingChanges={hasUnpublishedChanges(map, places, shapes)}
        />

        {/* A map carrying only shapes publishes something real, so this waits
            until there is genuinely nothing to put on a customer's site. */}
        {isEmpty ? (
          <p className="text-xs text-muted">
            This map has no locations yet, so it would publish empty. Add some on
            the Locations tab first.
          </p>
        ) : null}

        <ShareDialog map={map} />
        <PublishAction mapId={map.id} />
      </footer>
    </aside>
  );
}
