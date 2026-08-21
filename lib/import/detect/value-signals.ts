import { parseCoordinate, parseLatLngPair, parseMapLink } from "../coordinates";
import type { ImportField } from "../fields";
import { COUNTRY_WORDS } from "./countries";

/**
 * What a column contains, scored per field.
 *
 * This is the half of detection that survives a useless header row. Half the
 * files a brand actually has are exported by a system that names its columns
 * `Column1` or `F2` or `attribute_7`, and the original importer — which read
 * only headers — handed those users thirteen empty dropdowns.
 *
 * Values are more honest than names anyway. A column of things between -90 and
 * 90 with four decimal places is a latitude no matter what it's called, and a
 * column with eleven distinct values across four hundred rows is a category no
 * matter what it's called. Where a header and its contents disagree, the
 * contents are usually right.
 */

export type ColumnStats = {
  header: string;
  /** Non-empty values, capped by the caller's sample size. */
  values: string[];
  /** Of the sampled rows, how many had anything in this column at all. */
  filledRatio: number;
  distinctRatio: number;
  averageLength: number;
  numericRatio: number;
};

export function summarizeColumn(header: string, raw: string[]): ColumnStats {
  const values = raw.map((value) => value.trim()).filter(Boolean);

  if (values.length === 0) {
    return {
      header,
      values,
      filledRatio: 0,
      distinctRatio: 0,
      averageLength: 0,
      numericRatio: 0,
    };
  }

  const distinct = new Set(values.map((value) => value.toLowerCase())).size;
  const totalLength = values.reduce((sum, value) => sum + value.length, 0);
  const numeric = values.filter((value) => parseCoordinate(value) !== null).length;

  return {
    header,
    values,
    filledRatio: raw.length === 0 ? 0 : values.length / raw.length,
    distinctRatio: distinct / values.length,
    averageLength: totalLength / values.length,
    numericRatio: numeric / values.length,
  };
}

/**
 * 0 when the values say nothing, 1 when they're decisive.
 *
 * Deliberately conservative: a wrong confident guess is worse than no guess,
 * because the mapping step shows a guess as settled and a blank as a question.
 */
export function valueScore(field: ImportField, stats: ColumnStats): number {
  if (stats.values.length === 0) return 0;

  switch (field) {
    case "lat":
      return coordinateScore(stats, 90);
    case "lng":
      return coordinateScore(stats, 180);
    case "latlng":
      return ratio(stats, (value) => parseLatLngPair(value) !== null) * 0.95;
    case "email":
      return ratio(stats, isEmail) * 0.95;
    case "url":
      return ratio(stats, isUrl) * 0.9;
    case "phone":
      return phoneScore(stats);
    case "postcode":
      return postcodeScore(stats);
    case "country":
      return countryScore(stats);
    case "category":
      return categoryScore(stats);
    case "description":
      return descriptionScore(stats);
    case "name":
      return nameScore(stats);
    case "address":
      return addressScore(stats);
    case "city":
      return cityScore(stats);
    case "state":
      return stateScore(stats);
    default:
      return 0;
  }
}

/**
 * A latitude and a longitude look identical until one of them exceeds 90.
 *
 * That asymmetry is the only hard evidence available here, so it does the work:
 * a column inside ±90 could be either and scores moderately, a column that
 * leaves ±90 can only be longitude and scores high. Integers score lower than
 * decimals because a column of round numbers is far more often an id.
 */
function coordinateScore(stats: ColumnStats, limit: number): number {
  const parsed = stats.values.map(parseCoordinate);
  const numbers = parsed.filter((value): value is number => value !== null);

  if (numbers.length / stats.values.length < 0.9) return 0;

  const inRange = numbers.filter((value) => Math.abs(value) <= limit).length;
  if (inRange / numbers.length < 0.95) return 0;

  const fractional = numbers.filter((value) => !Number.isInteger(value)).length;
  const fractionalRatio = fractional / numbers.length;

  // Whole numbers in range are much more likely to be an id, a count or a year.
  if (fractionalRatio < 0.5) return 0.25;

  const beyond90 = numbers.filter((value) => Math.abs(value) > 90).length;

  if (limit === 180 && beyond90 > 0) {
    // Cannot be a latitude. This is the single most reliable signal in the file.
    return 0.98;
  }

  if (limit === 90 && beyond90 > 0) return 0;

  return 0.6;
}

function phoneScore(stats: ColumnStats): number {
  const looksLikePhone = ratio(stats, (value) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return false;

    // Anything outside the punctuation a phone number uses rules it out —
    // otherwise a street address full of digits scores here.
    if (!/^[+()\d\s./-]+$/.test(value)) return false;

    // A number whose only punctuation is a single dot is a decimal, and "113.4050"
    // is a longitude, not a phone number. Some European formats do separate with
    // dots, but they're indistinguishable from a decimal by shape alone, so this
    // declines rather than guessing — the header still catches them.
    return !/^-?\d+\.\d+$/.test(value);
  });

  // A column of bare 9-digit numbers could equally be an id, so the presence of
  // phone punctuation is what lifts this above a shrug.
  const punctuated = ratio(stats, (value) => /[+()\s-]/.test(value));

  return looksLikePhone * (0.55 + punctuated * 0.4);
}

function postcodeScore(stats: ColumnStats): number {
  const shaped = ratio(stats, (value) => {
    if (value.length < 3 || value.length > 10) return false;
    if (!/\d/.test(value)) return false;
    return /^[A-Za-z0-9][A-Za-z0-9\s-]*$/.test(value);
  });

  if (shaped < 0.8) return 0;

  // Postcodes repeat within a town but are mostly distinct across a country;
  // a column of five repeated values is a category, not a postcode.
  return shaped * (stats.distinctRatio > 0.3 ? 0.85 : 0.4);
}

function countryScore(stats: ColumnStats): number {
  const known = ratio(stats, (value) =>
    COUNTRY_WORDS.has(value.trim().toLowerCase()),
  );

  if (known < 0.7) return 0;

  // A locations file spans a handful of countries at most.
  return known * (stats.distinctRatio < 0.5 ? 0.95 : 0.7);
}

/**
 * The strongest signal we have, and one headers rarely provide.
 *
 * A category is by definition a small set repeated across many rows. Four
 * hundred locations tagged with six values is unmistakable, and it is exactly
 * the shape no header check can see.
 */
function categoryScore(stats: ColumnStats): number {
  if (stats.values.length < 4) return 0;
  if (stats.averageLength > 40) return 0;
  if (stats.numericRatio > 0.5) return 0;

  const distinctCount = Math.round(stats.distinctRatio * stats.values.length);

  // A column where every value is unique is a name; one with a single value is
  // a constant and tells us nothing.
  if (distinctCount < 2) return 0;
  if (stats.distinctRatio > 0.5) return 0;

  // The fewer distinct values relative to rows, the more category-like.
  const repetition = 1 - stats.distinctRatio;
  return Math.min(repetition * 1.2, 0.85);
}

function descriptionScore(stats: ColumnStats): number {
  if (stats.averageLength < 60) return 0;

  const sentences = ratio(stats, (value) => value.split(/\s+/).length >= 8);
  return sentences * 0.8;
}

function nameScore(stats: ColumnStats): number {
  if (stats.numericRatio > 0.3) return 0;
  if (stats.averageLength < 2 || stats.averageLength > 60) return 0;
  if (stats.distinctRatio < 0.7) return 0;

  // A name is mostly-unique short text that isn't any of the shapes we can
  // identify positively — so it stays modest and lets a header break the tie.
  const notSomethingElse = ratio(
    stats,
    (value) => !isEmail(value) && !isUrl(value) && !/^\+?[\d\s()-]{7,}$/.test(value),
  );

  return notSomethingElse * 0.5;
}

function addressScore(stats: ColumnStats): number {
  if (stats.averageLength < 6) return 0;
  if (stats.numericRatio > 0.3) return 0;

  // A street line is text with a building number in it, and often a comma.
  const withNumber = ratio(stats, (value) => /\d/.test(value) && /[a-z]/i.test(value));
  const streetish = ratio(stats, (value) =>
    /\d+\s*[a-z]|[a-z]\s*\d+|,/i.test(value),
  );

  if (withNumber < 0.5) return 0;

  return Math.min(withNumber * 0.5 + streetish * 0.35, 0.8);
}

function cityScore(stats: ColumnStats): number {
  if (stats.numericRatio > 0.1) return 0;
  if (stats.averageLength < 3 || stats.averageLength > 30) return 0;
  // A city name has no digits in it and no punctuation to speak of.
  const plainWords = ratio(stats, (value) => /^[^\d]{3,30}$/.test(value));

  if (plainWords < 0.85) return 0;

  // Repeats more than a name, less than a category — several locations per town.
  const inBand = stats.distinctRatio > 0.05 && stats.distinctRatio < 0.9;
  return inBand ? plainWords * 0.45 : plainWords * 0.2;
}

function stateScore(stats: ColumnStats): number {
  if (stats.numericRatio > 0.1) return 0;
  if (stats.averageLength > 30) return 0;

  const plain = ratio(stats, (value) => /^[^\d]{2,30}$/.test(value));
  if (plain < 0.85) return 0;

  // Fewer regions than towns, more than countries.
  return stats.distinctRatio < 0.4 ? plain * 0.4 : plain * 0.15;
}

function ratio(stats: ColumnStats, predicate: (value: string) => boolean): number {
  if (stats.values.length === 0) return 0;

  const matching = stats.values.filter(predicate).length;
  return matching / stats.values.length;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim());
}

function isUrl(value: string): boolean {
  const trimmed = value.trim();

  // A map link is a position, not a website, and scoring it as both would let
  // it win the url field and take the coordinates with it.
  if (parseMapLink(trimmed)) return false;

  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;

  // The final label has to be a real-looking TLD: two or more letters. Without
  // that clause "52.5200" is a perfectly good hostname as far as a regex is
  // concerned, and a column of latitudes scores as a column of websites.
  return /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(trimmed);
}
