"use client";

import { useState } from "react";

import { EmbedPreview } from "@/components/preview/embed-preview";
import { PageTitle } from "@/components/ui/page-title";
import { useMap } from "@/lib/query/maps";
import { usePlaces } from "@/lib/query/places";
import { useShapes } from "@/lib/query/shapes";
import type { AppMap, Place, Shape } from "@/lib/repositories/types";
import { DesignSidebar } from "./design-sidebar/design-sidebar";
import { useEmbedDesign } from "./design-sidebar/use-embed-design";
import { DEFAULT_DEVICE, deviceWidth, type DeviceId } from "./preview-device/devices";

/**
 * The Publish tab: the map as visitors will get it, and the controls that decide
 * what that means.
 *
 * It was five stacked panels in a 672px column — a box explaining publishing, a
 * box explaining the preview, the snippet, a row of switches, a domain list —
 * with the preview itself narrower than the embed's own 640px breakpoint, so the
 * results panel a visitor would see beside the map stacked underneath it
 * instead. The owner was looking at a layout their customers would never see,
 * and being told about it in prose.
 *
 * **The design column stands where the app nav does on every other page**
 * (`lib/layout/app-nav.ts` hides it here), so this page is one column of
 * controls and one map, edge to edge. That is what makes it read as a designer
 * rather than as a form with a picture beside it — and it is what gives the
 * preview the width to render the layout a desktop visitor will actually see.
 *
 * The draft is held here rather than inside the sidebar, because the preview
 * needs it too: `useEmbedDesign` writes on a 400ms trailing timer, and a preview
 * reading the saved row would lag every press by that timer. Same hook, two
 * readers, one writer.
 */
export function PublishPanel({
  initialMap,
  initialPlaces,
  initialShapes,
  initialCardDesign,
}: {
  initialMap: AppMap;
  initialPlaces: Place[];
  initialShapes: Shape[];
  /** Loaded server-side so the preview never builds a document twice — see
      `EmbedPreview`'s `cardDesign`. */
  initialCardDesign?: Record<string, unknown>;
}) {
  const { data: map = initialMap } = useMap(initialMap.id, initialMap);
  const { data: places = initialPlaces } = usePlaces(initialMap.id, initialPlaces);
  const { data: shapes = initialShapes } = useShapes(initialMap.id, initialShapes);

  const design = useEmbedDesign(map);
  const isEmpty = places.length === 0 && shapes.length === 0;

  /*
   * Local, and deliberately not part of the design.
   *
   * Which width the owner is *looking* at is not something a visitor ever gets,
   * so it has no business in `settings` — where it would also be a key in the
   * blob `useEmbedDesign` writes whole, and would change `rebuildKey` and cost
   * the preview a whole new document on every press.
   */
  const [device, setDevice] = useState<DeviceId>(DEFAULT_DEVICE);
  const width = deviceWidth(device);

  return (
    <>
      <PageTitle>Publish</PageTitle>

      {/*
        `lg:flex-none` is load-bearing: without it `flex-1`'s `flex-basis: 0%`
        beats `height` on the main axis and the definite height is silently
        ignored, leaving the page to grow instead of the column to scroll. The
        full `100dvh` rather than a subtraction, because this page has no
        `Container` padding above it and `MobileHeader` is `md:hidden`.

        **`lg` and not `xl`.** The embed decides its own shape with a container
        query at 640px of its own width, and under that it stacks the results
        panel below the map — right on a phone, wrong as the only thing a
        designer ever shows. With the app nav gone, `1024 − 320` leaves the frame
        704px, which clears it; below `lg` the page stacks and the map takes the
        full width, clearing it by more. There is deliberately no
        `publish/loading.tsx` to keep these strings in step with — see CLAUDE.md
        on why this route has no loading boundary.
      */}
      <div className="flex min-h-0 flex-1 flex-col lg:h-[100dvh] lg:flex-none lg:flex-row">
        {/* The map first in source, so a phone gets the subject before the
            controls; `lg:order-first` puts the column back on the left where
            the nav was as soon as there are two columns. */}
        <div className="relative order-1 h-[55dvh] min-h-64 w-full lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1">
          {/* A map of nothing but shapes is a real map — a delivery area needs
              no pins in it — so the empty state waits until both are empty. */}
          {isEmpty ? (
            <div className="flex h-full items-center justify-center bg-surface-secondary p-4">
              <p className="text-pretty text-center text-xs text-muted">
                Add some locations on the Locations tab and they&rsquo;ll show up
                here.
              </p>
            </div>
          ) : (
            <EmbedPreview
              map={map}
              places={places}
              shapes={shapes}
              settings={design.settings}
              cardDesign={initialCardDesign}
              frame={false}
              maxWidth={width ?? undefined}
              className="h-full w-full"
            />
          )}
        </div>

        {/* The width tiles live in this column's header rather than over the
            map — see `DeviceToggle`. They are the one control up there that is
            not `design`, which is why the state stays here and comes back down
            as props rather than joining the draft. */}
        <DesignSidebar
          map={map}
          places={places}
          shapes={shapes}
          design={design}
          device={device}
          onDeviceChange={setDevice}
        />
      </div>
    </>
  );
}
