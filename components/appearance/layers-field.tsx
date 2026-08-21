"use client";

import { Description, Switch } from "@heroui/react";

import type { LayerToggles } from "@/packages/shared/style-layers";

/**
 * What the basemap draws, beyond the ground it starts with.
 *
 * Every one of these is already inside the vector tiles the map fetches anyway,
 * so switching one on costs no request and no money — which is the only reason
 * this feature can exist at all under CLAUDE.md §2.
 *
 * The note at the end names what is deliberately missing. The competition offers
 * live traffic and satellite imagery here; both are metered third-party data in
 * the visitor's path, and this product charges a flat fee precisely because
 * nothing in that path is metered. Saying so is better than a greyed-out switch,
 * which reads as a bug or as an upsell.
 */
const LAYERS = [
  {
    name: "poi",
    label: "Points of interest",
    description:
      "Shops, cafés, schools and hospitals from OpenStreetMap. Turn off to keep attention on your own locations.",
  },
  {
    name: "transit",
    label: "Railways and transit",
    description: "Rail lines, tram and metro routes, and station markers.",
  },
  {
    name: "buildings",
    label: "Buildings",
    description: "Building footprints, from street level in.",
  },
  {
    name: "buildings3d",
    label: "3D buildings",
    description: "Extrudes those footprints to their real heights when zoomed right in.",
  },
  {
    name: "paths",
    label: "Paths and pedestrian streets",
    description: "Footpaths, tracks and pedestrianised streets.",
  },
  {
    name: "cycling",
    label: "Cycle paths",
    description:
      "Draws dedicated cycleways in green, over the basemap. Off by default — most maps don't need it.",
  },
] as const satisfies readonly {
  name: keyof LayerToggles;
  label: string;
  description: string;
}[];

export function LayersField({
  value,
  onChange,
}: {
  value: Required<LayerToggles>;
  onChange: (layers: Required<LayerToggles>) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">Layers</legend>

      <div className="mt-2 space-y-3">
        {LAYERS.map((layer) => (
          <Switch
            key={layer.name}
            isSelected={value[layer.name]}
            onChange={(isSelected) =>
              onChange({ ...value, [layer.name]: isSelected })
            }
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              {layer.label}
            </Switch.Content>
            <Description>{layer.description}</Description>
          </Switch>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted">
        No live traffic or satellite imagery: both are paid third-party feeds
        charged per map view, and your maps are unlimited because nothing here
        costs anything to look at.
      </p>
    </fieldset>
  );
}
