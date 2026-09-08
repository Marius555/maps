"use client";

import { Label, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { MapSkeleton } from "@/components/map/map-skeleton";
import type { MapStyleKey } from "@/lib/map/style";
import { selectionBounds } from "@/lib/map/selection-bounds";
import type { HeatPoint } from "@/lib/analytics/view";

/**
 * Two questions, one canvas.
 *
 * **Where visitors are** and **where they interact** are different maps of the
 * same audience, and the interesting thing is nearly always the gap between
 * them: a brand whose visitors are all in one city and whose opens are spread
 * across the country is being found by people who cannot reach the shops.
 * Putting them side by side would halve each map on a page that already has a
 * lot on it; a toggle keeps both full width and makes the comparison an A/B
 * flick rather than a saccade.
 *
 * `ssr: false` has to be called from a client module — MapLibre touches `window`
 * at module load, and Next 16 throws if `dynamic({ ssr: false })` is called from
 * a Server Component. That is the reason this file and the impl are separate,
 * and the impl is imported nowhere else.
 */
const HeatMapImpl = dynamic(() => import("./heat-map-impl"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

type Layer = "visitors" | "interactions";

export function HeatMap({
  origins,
  interactions,
  center,
  zoom,
  style,
  appearance,
}: {
  origins: HeatPoint[];
  interactions: HeatPoint[];
  center: { lng: number; lat: number };
  zoom: number;
  style: MapStyleKey;
  appearance?: Record<string, unknown>;
}) {
  /*
   * Opens on whichever has something to show.
   *
   * Visitor origins need the host to report geography, which Appwrite does not
   * document (lib/analytics/collect/geo-headers.ts) — so on some deployments
   * that layer is simply empty, and opening on an empty map would read as the
   * feature being broken rather than as one input being unavailable.
   */
  const [layer, setLayer] = useState<Layer>(
    origins.length > 0 ? "visitors" : "interactions",
  );

  const points = layer === "visitors" ? origins : interactions;

  /*
   * The frame follows the layer, so switching to visitor origins does not leave
   * the camera sitting over the customer's shops with the heat off screen.
   * `key` remounts the canvas, which is the honest way to reframe: `useMaplibre`
   * reads its opening view once, by design.
   */
  const canvasKey = useMemo(() => `${layer}-${String(points.length)}`, [layer, points.length]);

  /*
   * Framed on the layer's own points rather than on the map's locations.
   *
   * The two layers cover different ground — a Lithuanian brand's shops sit in
   * one country while its visitors may be spread across Europe — so a single
   * frame computed from the locations would open the visitor map on a box with
   * most of its heat outside it. `selectionBounds` is the same helper the editor
   * frames a group with, and a heat point is a point like any other.
   */
  const bounds = useMemo(
    () => selectionBounds({ points, geometries: [] }),
    [points],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <ToggleButtonGroup
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[layer]}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next === "visitors" || next === "interactions") setLayer(next);
          }}
        >
          <Label className="sr-only">What the map shows</Label>
          <ToggleButton id="visitors" size="sm" isDisabled={origins.length === 0}>
            Where visitors are
          </ToggleButton>
          <ToggleButton id="interactions" size="sm" isDisabled={interactions.length === 0}>
            Where they look
          </ToggleButton>
        </ToggleButtonGroup>

        <p className="text-xs text-muted">{caption(layer, origins.length)}</p>
      </div>

      <div className="h-[min(55dvh,460px)]">
        {points.length > 0 ? (
          <HeatMapImpl
            key={canvasKey}
            points={points}
            bounds={bounds}
            center={center}
            zoom={zoom}
            style={style}
            appearance={appearance}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl bg-surface-secondary px-6 text-center text-sm text-muted">
            Nothing to draw here yet.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * What the picture is, said once.
 *
 * The visitor layer's caption names its own limitation rather than hiding it: a
 * blob the size of a country *is* the answer when the only geography available
 * is a country code, and a customer who reads it as street-level precision has
 * been misled by us rather than by their data.
 */
function caption(layer: Layer, origins: number): string {
  if (layer === "interactions") {
    return "Your locations, sized by how often visitors opened them";
  }

  return origins > 0
    ? "Roughly where visitors were — country or city level, never precise"
    : "No location data from your host";
}
