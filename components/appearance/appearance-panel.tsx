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
 * Rendered in two places — the editor toolbar's popover and the Settings tab —
 * which is the whole reason it takes `value` and `onChange` and owns no fetching
 * of its own. A second gallery on the settings page would be a second list to
 * add every future theme to, and the two would drift the first time someone
 * forgot.
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
