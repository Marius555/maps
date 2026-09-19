import type { Place } from "@/lib/repositories/types";
import {
  resolvePin,
  UNTAGGED_PIN_COLOR,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";

/**
 * A location as an off-screen renderer wants it: a point, an icon id and one
 * resolved colour.
 *
 * Its own file, apart from the layers that draw it (./place-features.ts), because
 * two sides build these: the editor's export in the browser, and the maps list's
 * preview route on the server. The server half must not pull in the pin
 * rasteriser, which is browser code.
 */
export type ExportPlace = {
  lng: number;
  lat: number;
  /** Empty for a plain dot. The caller resolves `custom:` ids the same way. */
  icon: string;
  /** Already resolved by the caller — category, group and custom pin ranked. */
  color: string;
};

/**
 * The colour is ranked exactly as `paint` in use-place-markers.ts ranks it — a
 * custom pin's own colour offered to the resolver, which may override it with a
 * group's. The final fallback is the fixed grey rather than the dashboard's
 * `--accent`, because a rendered image has no theme to read and `--accent` is an
 * `oklch()` value that neither MapLibre's colour parser nor a canvas fill would
 * take.
 */
export function toExportPlace(
  place: Place,
  pinIcons: readonly CustomPinIcon[] | undefined,
  colorFor: (place: Place, pinColor?: string) => string | undefined,
): ExportPlace {
  const pin = resolvePin(place.icon, pinIcons);

  return {
    lng: place.lng,
    lat: place.lat,
    icon: place.icon,
    color: colorFor(place, pin?.color ?? undefined) ?? UNTAGGED_PIN_COLOR,
  };
}
