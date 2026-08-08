/** ~1cm precision. Enough for a shop front, short enough to read in a list. */
export function roundCoord(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function isValidLngLat(lng: number, lat: number): boolean {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

export function formatCoords(lat: number, lng: number): string {
  return `${roundCoord(lat, 4)}, ${roundCoord(lng, 4)}`;
}
