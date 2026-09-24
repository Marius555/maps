"use client";

import { Separator } from "@heroui/react";

import type { MapStyleKey } from "@/lib/map/style";
import type { MapAppearanceSettings } from "@/lib/validation/map-appearance.schema";
import { LabelsField } from "./labels-field";
import { LayersField } from "./layers-field";
import { ThemeGallery } from "./theme-gallery";

/**
 * Everything about how the basemap looks, in one panel.
 *
 * Rendered in the editor toolbar's popover, and only there. It used to be drawn
 * on the map's Settings tab as well, which is why it takes `value` and `onChange`
 * and owns no fetching of its own — keep it that way, so a second surface never
 * means a second list to add every future theme to.
 *
 * The order is the order the choices matter in: the style is the decision, and
 * labels and layers are adjustments to it.
 */
export function AppearancePanel({
  style,
  appearance,
  onChangeStyle,
  onChangeAppearance,
  error,
}: {
  style: MapStyleKey;
  appearance: MapAppearanceSettings;
  onChangeStyle: (style: MapStyleKey) => void;
  onChangeAppearance: (appearance: MapAppearanceSettings) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ThemeGallery value={style} onChange={onChangeStyle} error={error} />

      <Separator />

      <LabelsField
        value={appearance.labels}
        onChange={(labels) => onChangeAppearance({ ...appearance, labels })}
      />

      <Separator />

      <LayersField
        value={appearance.layers}
        onChange={(layers) => onChangeAppearance({ ...appearance, layers })}
      />
    </div>
  );
}
