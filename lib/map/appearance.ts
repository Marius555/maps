import { MIDNIGHT_TINT } from "@/packages/shared/darken-style";
import {
  isPlainAppearance,
  type MapAppearance,
} from "@/packages/shared/map-appearance";
import { readMapAppearance } from "@/lib/validation/map-appearance.schema";
import { resolveTint, shouldDarkenStyle, type MapStyleKey } from "./style";

/**
 * A map's stored choices → the one object that restyles a basemap.
 *
 * Two sources feed it and they must never both win. A **theme** carries its own
 * tint and is the same for everyone who looks at the map. **Auto** carries none,
 * and is instead darkened or not depending on who is looking — the dashboard's
 * theme in the editor, `prefers-color-scheme` in a published embed. A theme is
 * therefore checked first and Auto's darkening only applies when there is no
 * theme to apply, which there never is, because Auto is not a theme.
 *
 * Returns null when the answer is "leave the basemap exactly as it ships", which
 * is what lets `loadMapStyle` hand MapLibre a plain URL and skip the fetch
 * entirely. That is the common case and it has to stay free.
 */
export function effectiveAppearance(
  style: MapStyleKey,
  stored: Record<string, unknown> | undefined,
  prefersDark: boolean,
): MapAppearance | null {
  const settings = readMapAppearance(stored ?? {});
  const tint =
    resolveTint(style) ?? (shouldDarkenStyle(style, prefersDark) ? MIDNIGHT_TINT : null);

  const appearance: MapAppearance = {
    ...(tint ? { tint } : {}),
    labels: settings.labels,
    layers: settings.layers,
  };

  return isPlainAppearance(appearance) ? null : appearance;
}
