/**
 * Coordinates in the shapes they actually arrive in.
 *
 * A tidy pair of decimal columns is the case the original import handled and the
 * rarest one in practice. Real files carry a single "52.52, 13.405" column, a
 * pasted Google Maps link, degrees-minutes-seconds off a survey, a decimal comma
 * from a European spreadsheet, or latitude and longitude the wrong way round.
 * Every one of those is a location silently landing in the Atlantic.
 */

export type LatLng = { lat: number; lng: number };

/**
 * One number.
 *
 * Accepts a decimal comma, because exports from European spreadsheets write
 * "54,687" and reading that as 54 would drop the location in the wrong country.
 * A value carrying both a comma and a dot is thousands-separated, not decimal.
 */
export function parseCoordinate(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dms = parseDms(trimmed);
  if (dms !== null) return dms;

  const normalized =
    trimmed.includes(",") && !trimmed.includes(".")
      ? trimmed.replace(",", ".")
      : trimmed.replace(/,/g, "");

  // Number("") is 0 and Number(" ") is 0; both would place a pin off Ghana.
  if (!/\d/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Both numbers out of one cell.
 *
 * Handles a bare pair, a parenthesised pair, a DMS pair, and a map link — the
 * four ways one column ends up holding a position.
 */
export function parseLatLngPair(value: string): LatLng | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const fromLink = parseMapLink(trimmed);
  if (fromLink) return fromLink;

  // Strip wrappers: "(52.52, 13.405)" and "[52.52 13.405]" are both common.
  const inner = trimmed.replace(/^[([{\s]+/, "").replace(/[)\]}\s]+$/, "");

  // Split on a comma, a semicolon, a slash, or whitespace — but only where it
  // separates two numbers, so "52,52" (one decimal-comma number) isn't read as
  // the pair 52 and 52.
  const parts = splitPair(inner);
  if (!parts) return null;

  const lat = parseCoordinate(parts[0]);
  const lng = parseCoordinate(parts[1]);

  if (lat === null || lng === null) return null;
  if (!isValidLat(lat) || !isValidLng(lng)) return null;

  return { lat, lng };
}

/**
 * A position out of a maps URL.
 *
 * People building a locations sheet by hand paste map links, because that is the
 * artefact they have. Both Google forms are covered: `@lat,lng,zoom` from the
 * address bar and `?q=lat,lng` from a share sheet.
 */
export function parseMapLink(value: string): LatLng | null {
  if (!/https?:\/\//i.test(value) && !/^www\./i.test(value)) return null;

  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|ll|center|daddr|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /\/(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(value);
    if (!match) continue;

    const lat = Number(match[1]);
    const lng = Number(match[2]);

    if (isValidLat(lat) && isValidLng(lng)) return { lat, lng };
  }

  return null;
}

/**
 * Degrees, minutes, seconds → decimal.
 *
 * `52°31'12"N` and `52 31 12 N` and `N 52° 31.2'` are all the same place. The
 * hemisphere letter is what makes this unambiguous, and it is also the reason a
 * DMS value can be negative without a minus sign.
 */
export function parseDms(value: string): number | null {
  const match =
    /^\s*([NSEW])?\s*(\d+(?:[.,]\d+)?)\s*[°d:\s]\s*(?:(\d+(?:[.,]\d+)?)\s*['′m:\s]?\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:''|["″s])?\s*)?([NSEW])?\s*$/i.exec(
      value,
    );

  if (!match) return null;

  const leading = match[1];
  const trailing = match[5];
  const hemisphere = (leading ?? trailing)?.toUpperCase();

  // Without a hemisphere letter this is just a number with stray punctuation,
  // and guessing would be worse than declining.
  if (!hemisphere) return null;
  if (leading && trailing) return null;

  const degrees = decimal(match[2]);
  const minutes = decimal(match[3] ?? "0");
  const seconds = decimal(match[4] ?? "0");

  if (degrees === null || minutes === null || seconds === null) return null;
  if (minutes >= 60 || seconds >= 60) return null;

  const magnitude = degrees + minutes / 60 + seconds / 3600;
  const signed = hemisphere === "S" || hemisphere === "W" ? -magnitude : magnitude;

  const limit = hemisphere === "N" || hemisphere === "S" ? 90 : 180;
  return Math.abs(signed) <= limit ? signed : null;
}

export function isValidLat(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= 90;
}

export function isValidLng(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= 180;
}

/**
 * Do these two columns look swapped?
 *
 * Longitudes past ±90 cannot be latitudes, so a "latitude" column full of them
 * is the one mistake in this whole area that can be detected with certainty
 * rather than guessed at. Anything east of Portugal or west of the Azores
 * triggers it, which is most of the world.
 */
export function looksSwapped(
  pairs: { lat: string; lng: string }[],
): boolean {
  let impossible = 0;
  let checked = 0;

  for (const pair of pairs) {
    const lat = parseCoordinate(pair.lat);
    const lng = parseCoordinate(pair.lng);

    if (lat === null || lng === null) continue;
    checked += 1;

    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) impossible += 1;
  }

  // A couple of bad rows are bad rows; most of the file being impossible is a
  // pair of columns in the wrong order.
  return checked >= 3 && impossible / checked > 0.5;
}

function splitPair(value: string): [string, string] | null {
  const separators = [/\s*[;|/]\s*/, /\s*,\s*/, /\s+/];

  for (const separator of separators) {
    const parts = value.split(separator).filter(Boolean);
    if (parts.length !== 2) continue;

    // "52,52" splits into two halves of one decimal-comma number. Two numbers
    // that both look like whole degrees with no fraction between them is far
    // more likely to be that than a real pair at an exact integer position.
    if (separator.source === /\s*,\s*/.source) {
      const looksLikeOneNumber =
        /^-?\d{1,3}$/.test(parts[0]) && /^\d{1,8}$/.test(parts[1]);
      if (looksLikeOneNumber) continue;
    }

    return [parts[0], parts[1]];
  }

  return null;
}

function decimal(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
