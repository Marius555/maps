import { DEFAULT_CENTER } from "@/lib/config";

/**
 * Whether the owner has ever chosen this map's opening view.
 *
 * There is no flag for it — "Save this view" writes `defaultLat/Lng/Zoom` and
 * nothing records that it happened — so the question is answered by asking
 * whether the stored view is still one nobody chose. That is exactly what the
 * editor needs to know: a map framed on the whole world with two hundred pins on
 * it is a map whose owner never told us where to open, not a map they opened
 * there on purpose.
 *
 * `LEGACY_CENTERS` is the reason this is a list rather than one comparison.
 * Every map created before the default became the world holds Vilnius, and those
 * owners chose it exactly as little as today's choose the world — treating that
 * triple as deliberate would leave every existing map opening on a city in
 * Lithuania forever, which is the bug this shipped to fix.
 */
const LEGACY_CENTERS = [
  // The default from the first release through to the world view.
  { lat: 54.687, lng: 25.28, zoom: 11 },
] as const;

type View = { defaultLat: number; defaultLng: number; defaultZoom: number };

export function isDefaultView(map: View): boolean {
  return [DEFAULT_CENTER, ...LEGACY_CENTERS].some(
    (center) =>
      map.defaultLat === center.lat &&
      map.defaultLng === center.lng &&
      map.defaultZoom === center.zoom,
  );
}
