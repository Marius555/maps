import { normalizeHeader } from "@/lib/import/detect/normalize";

/**
 * What a feature says about itself, beyond its geometry.
 *
 * The old reader took a name from five exact spellings and threw the rest of the
 * property bag away — so a file that already carried its own colours imported as
 * thirteen shapes in a rotating palette, and a file whose name field was called
 * `zoneName` imported as "Area 1".
 *
 * Matching goes through `normalizeHeader`, the same folding
 * `lib/import/detect/synonyms.ts` uses for spreadsheet columns: case, spaces,
 * punctuation and accents are stripped, so one entry covers `Zone Name`,
 * `zone_name` and `zoneName`, and `Bezeichnung` reaches its own entry rather
 * than needing one per diacritic.
 *
 * The colour list leads with `fill` and `stroke` because those are the
 * simplestyle spec, which is what geojson.io, QGIS and GitHub's own GeoJSON
 * renderer all write — a file that has been styled once already has an opinion,
 * and overriding it with our palette is discarding work someone did.
 */

export type ShapeProperties = {
  name: string | null;
  description: string | null;
  /** Lowercase `#rrggbb`, or null when the file named no colour we understood. */
  color: string | null;
  /** 0–1, or null. */
  opacity: number | null;
};

/**
 * Name candidates, best first.
 *
 * Anything ending in `name` ranks below the whole list and above the last
 * resort — that is the entry which reads `zoneName`, `NAME_EN` and `name:en`
 * without needing one line each.
 */
const NAME_KEYS = [
  "name",
  "title",
  "label",
  "nameen",
  "zonename",
  "areaname",
  "regionname",
  "districtname",
  "displayname",
  "nom",
  "nombre",
  "naam",
  "nazwa",
  "bezeichnung",
  "titel",
  "titulo",
  "zone",
  "area",
  "region",
  "district",
  "ward",
  "sector",
  "territory",
] as const;

/**
 * Only reached when nothing above matched. An id is a poor name and a much
 * better one than "Area 7": it is at least the thing the file calls this shape,
 * and it is what the user will search their own source for.
 */
const ID_KEYS = new Set(["id", "ref", "code", "key", "fid", "objectid", "gid"]);

const DESCRIPTION_KEYS = [
  "description",
  "desc",
  "notes",
  "note",
  "comment",
  "comments",
  "summary",
  "details",
  "remarks",
  "info",
  "beschreibung",
  "descripcion",
] as const;

const COLOR_KEYS = [
  "fill",
  "stroke",
  "color",
  "colour",
  "fillcolor",
  "fillcolour",
  "strokecolor",
  "strokecolour",
  "markercolor",
  "markercolour",
  "hex",
] as const;

const OPACITY_KEYS = ["fillopacity", "opacity", "fillalpha", "alpha"] as const;

/** The schema's own ceiling on a description. */
const MAX_DESCRIPTION = 5000;

export function readProperties(
  bag: Record<string, unknown> | null,
): ShapeProperties {
  if (!bag) return { name: null, description: null, color: null, opacity: null };

  return {
    name: readName(bag),
    description: pick(bag, DESCRIPTION_KEYS, readText)?.slice(0, MAX_DESCRIPTION) ?? null,
    color: pick(bag, COLOR_KEYS, readHex),
    opacity: pick(bag, OPACITY_KEYS, readOpacity),
  };
}

/**
 * The first key in `keys` that carries a value the reader accepts.
 *
 * Ranked by the table rather than by the object's own key order, so a feature
 * listing `stroke` before `fill` still fills with `fill` — otherwise two files
 * with identical styling would import differently depending on how their
 * exporter happened to serialise them.
 */
function pick<T>(
  bag: Record<string, unknown>,
  keys: readonly string[],
  read: (value: unknown) => T | null,
): T | null {
  const folded = new globalThis.Map<string, unknown>();

  for (const [key, value] of Object.entries(bag)) {
    const name = normalizeHeader(key);
    if (!folded.has(name)) folded.set(name, value);
  }

  for (const key of keys) {
    const found = read(folded.get(key));
    if (found !== null) return found;
  }

  return null;
}

function readName(bag: Record<string, unknown>): string | null {
  const listed = pick(bag, NAME_KEYS, readText);
  if (listed) return listed;

  // Anything *ending* in "name". Ordered by the object's own keys, because at
  // this point the file has told us nothing about which of them it prefers.
  for (const [key, value] of Object.entries(bag)) {
    const folded = normalizeHeader(key);
    if (!folded.endsWith("name")) continue;

    const text = readText(value);
    if (text) return text;
  }

  for (const [key, value] of Object.entries(bag)) {
    if (!ID_KEYS.has(normalizeHeader(key))) continue;

    const text = readText(value);
    if (text) return text;
  }

  return null;
}

/**
 * A property value → a line of text.
 *
 * Numbers are accepted because JSON derived from a spreadsheet types its ids and
 * its postcodes as numbers, and a name that came through as `40231` is still the
 * name the file gave this shape.
 */
function readText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * A colour → lowercase `#rrggbb`, the one form `hexColorSchema` accepts.
 *
 * Shorthand is expanded and an alpha channel is dropped rather than refused: a
 * `#3b82f680` is a real colour with an opacity beside it, and the opacity has its
 * own field here. Named CSS colours are not resolved — that is a 148-entry table
 * for a case no export produces, and the palette fallback is a better answer than
 * a partial one.
 */
function readHex(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const hex = value.trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]+$/.test(hex)) return null;

  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }

  if (hex.length === 6 || hex.length === 8) return `#${hex.slice(0, 6)}`;

  return null;
}

/**
 * An opacity → 0–1.
 *
 * A value above 1 is read as a percentage, which is what a file writing `20`
 * means by it — nobody intends an opacity of twenty, and clamping it to 1 would
 * silently turn a translucent zone opaque.
 */
function readOpacity(value: unknown): number | null {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : NaN;

  if (!Number.isFinite(amount) || amount < 0) return null;
  if (amount > 100) return null;

  const fraction = amount > 1 ? amount / 100 : amount;
  return Math.min(fraction, 1);
}
