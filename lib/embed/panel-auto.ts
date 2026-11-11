import { isValidLngLat } from "@/lib/map/geo";
import type { EmbedSettings } from "@/lib/validation/embed-settings.schema";

/**
 * The results panel that follows the number of locations.
 *
 * A map with one location has nothing to list: a sidebar or a drawer beside a
 * single pin repeats what its card says, and a search box over one place finds
 * the place already on screen. So while `listAuto` is on, a map with one
 * location (or none) publishes no panel and no search box, and a map with two
 * or more publishes the panel. "Nearest to me" is left as the owner set it.
 *
 * **One resolver for both halves.** `buildSnapshot` calls it with the locations
 * it is about to write, and the designer calls it with the same count
 * (`publishedPlaceCount`), so the switch, the preview and the published map
 * cannot disagree. It is resolved at publish time rather than in the embed, so
 * the embed bundle pays nothing for it, and a sheet sync that takes a map from
 * one row to two gains its panel on that sync.
 *
 * The designer keeps the *unresolved* settings as the base it writes to
 * (`use-embed-design.ts`). Writing the resolved ones would store `search: false`
 * on any unrelated change, and the map would come back without a search box
 * once it grew.
 */

/** How many of these locations a publish would carry: the ones with a position. */
export function publishedPlaceCount(
  places: readonly { lat: number; lng: number }[],
): number {
  let count = 0;
  for (const place of places) if (isValidLngLat(place.lng, place.lat)) count++;

  return count;
}

/** Whether the automatic rule is hiding the panel for a one-location map. */
export function isSingleAuto(
  settings: Pick<EmbedSettings, "listAuto">,
  count: number,
): boolean {
  return settings.listAuto && count <= 1;
}

/** `settings` with the automatic panel decided for `count` locations. */
export function resolvePanelAuto(
  settings: EmbedSettings,
  count: number,
): EmbedSettings {
  if (!settings.listAuto) return settings;

  return isSingleAuto(settings, count)
    ? { ...settings, list: false, search: false }
    : { ...settings, list: true };
}
