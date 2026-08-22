/**
 * Where the embed fetches the gazetteer its search reads.
 *
 * Shaped exactly like `embedScriptUrl` in lib/embed/snippet.ts, and for the same
 * reason: point `NEXT_PUBLIC_GAZETTEER_URL` at the CDN in production, and leave
 * it unset for development and self-hosting, where the app serves the files
 * itself and there is nothing to configure.
 *
 * **Absolute, always.** The embed runs on a customer's page, so a relative URL
 * would resolve against *their* domain and 404 on every site but ours. Nothing
 * here may return a path.
 */

/** Where `npm run build:gazetteer` writes, under /public. */
export const GAZETTEER_PATH = "/gazetteer";

export function gazetteerBase(origin: string): string {
  return process.env.NEXT_PUBLIC_GAZETTEER_URL || `${origin}${GAZETTEER_PATH}`;
}

/**
 * Which countries a map's locations sit in, ISO-2 and uppercase.
 *
 * Read off `addressParts`, which the geocoder filled in at import time and which
 * exists precisely because its answer was kept in parts rather than flattened
 * into the address line (lib/validation/place.schema.ts). So this costs nothing:
 * no lookup, no request, no second pass over anything.
 *
 * A map whose pins were all dropped by hand with no reverse geocode has no
 * countries here, and publishes no gazetteer at all. That is the honest answer —
 * we do not know where those pins are, and guessing a country from a coordinate
 * would need the very lookup table this is trying to fetch.
 */
export function gazetteerCountries(
  places: { addressParts: { countryCode?: string } | null }[],
): string[] {
  const codes = new Set<string>();

  for (const place of places) {
    const code = place.addressParts?.countryCode?.trim().toUpperCase();
    // Two letters exactly: Photon occasionally answers with something longer,
    // and a code that names no shard is a 404 on every keystroke.
    if (code && /^[A-Z]{2}$/.test(code)) codes.add(code);
  }

  // Sorted so a republish of an unchanged map produces an unchanged file.
  return [...codes].sort();
}
