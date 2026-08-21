import { normalizeHeader } from "./normalize";
import { FIELD_SYNONYMS } from "./synonyms";

/**
 * Which row of the grid is the header?
 *
 * Row 0 is the right answer often enough that assuming it got us a long way, but
 * real spreadsheets carry a title banner, a blank spacer, an export timestamp, a
 * units row, or a placeholder row an export tool wrote above the real names.
 * Guessing wrong is the worst failure in the whole import: every column gets
 * named after something that isn't a column name, detection has nothing to work
 * with, and a row of real data silently disappears into the header.
 *
 * The model is **the row that best explains what sits beneath it**. Header
 * likeness is only a gate — it rules out titles, banners and obvious data rows,
 * but it cannot separate two rows that both read as names, which is exactly the
 * case that breaks. Among the survivors, three signals rank:
 *
 * - **Coherence** — how tidy the columns *below* the candidate are. Take a
 *   placeholder row as the header and the column under it reads
 *   ["lat_coord", "40.7388", "-73.9904"], which is a mess; take the row after it
 *   and the same column is all numbers. A header row is the row whose removal
 *   leaves clean columns, and that holds without knowing a single column name.
 * - **Informativeness** — how many of the candidate's own cells read as field
 *   names we recognise. A bonus, never a requirement, so a header in a language
 *   the synonym table doesn't stock still wins on coherence alone. It is also
 *   what keeps a units row (text, deg, deg) from beating the real header above
 *   it, since a units row scores perfectly on coherence.
 * - **Earliness** — a later row must be *clearly* better, not merely better, so
 *   a genuine tie resolves to the conventional answer. This is what stops a real
 *   two-column file whose first location happens to be all text (Alpha, Berlin)
 *   from having that location eaten as a header.
 *
 * Deliberately absent: any list of placeholder names. Blacklisting
 * /^(column|field|unnamed)\d+$/ would fix one vendor's export and do nothing for
 * "Spalte1", "Feld_1" or "Unnamed: 0" — and it would teach the importer to
 * expect one file's shape instead of reading whatever it is handed.
 */

/** A header more than this far down is a spreadsheet we shouldn't guess about. */
const MAX_HEADER_ROW = 10;

/** A header spanning less of the grid than this is a title, not column names. */
const MIN_COVERAGE = 0.5;

/**
 * Column names are words.
 *
 * A row where a third of the cells are bare numbers is the first location in the
 * file, not a description of the ones below it.
 */
const MIN_TEXTUAL = 0.7;

/** How many rows below a candidate are read to judge how tidy its columns are. */
const COHERENCE_SAMPLE = 20;

/** A column needs this many values under the candidate before it may vote. */
const MIN_COHERENCE_VALUES = 2;

/**
 * Rows below a candidate before its coherence is believed in full.
 *
 * Coherence measured on two rows and coherence measured on twenty are not the
 * same evidence, and scoring them identically is what let a data row near the
 * end of a short file win: almost nothing sat under it, so every column was
 * trivially homogeneous and it scored a perfect 1.0. Below this many rows the
 * score is pulled back towards the neutral 0.5 in proportion to what was
 * actually measured, so a thin sample can no longer outrank a real header with a
 * whole file under it.
 */
const CONFIDENT_COHERENCE_ROWS = 5;

/**
 * Coherence and informativeness carry the same weight.
 *
 * Neither is reliable alone, and they fail in opposite directions: a units row
 * is perfectly coherent and says nothing, while the real header above it is
 * fully informative and looks incoherent. Weighted equally, each case clears the
 * other by a comfortable margin rather than by a rounding error.
 */
const COHERENCE_WEIGHT = 0.5;
const INFORMATIVENESS_WEIGHT = 0.5;

/**
 * How much better a later row must score to displace an earlier one.
 *
 * A fixed margin rather than a per-row penalty: a penalty that accumulated would
 * make row 8 unwinnable whatever it contained, and the bias wanted here is only
 * "break ties upward", not "distrust the bottom of the file".
 */
const EARLINESS_MARGIN = 0.05;

/**
 * A synonym shorter than this matches too much to be evidence of anything.
 *
 * `lng` lists "x" and `lat` lists "y"; as prefixes those would make almost every
 * cell in the file look like a column name.
 */
const MIN_SYNONYM_LENGTH = 3;

export type HeaderRowDetection = {
  /** null when no row reads as a header — the caller then synthesises names. */
  headerRowIndex: number | null;
  /** How well the chosen row explains the data below it. 0 when there is none. */
  confidence: number;
};

export function detectHeaderRow(cells: string[][]): HeaderRowDetection {
  const width = usedWidth(cells);
  const limit = Math.min(cells.length, MAX_HEADER_ROW);

  let bestIndex: number | null = null;
  let bestScore = 0;

  for (let index = 0; index < limit; index += 1) {
    const row = cells[index];
    if (!row) continue;

    // A row with nothing under it describes nothing.
    if (index + 1 >= cells.length) break;

    if (!couldBeHeader(row, width)) continue;

    const score =
      coherenceBelow(cells, index, width) * COHERENCE_WEIGHT +
      informativeness(row) * INFORMATIVENESS_WEIGHT;

    if (bestIndex === null || score > bestScore + EARLINESS_MARGIN) {
      bestIndex = index;
      bestScore = score;
    }
  }

  return {
    headerRowIndex: bestIndex,
    confidence: bestIndex === null ? 0 : bestScore,
  };
}

/**
 * Three gates, each ruling out a real shape: too few cells rules out a title,
 * too narrow rules out a banner sitting over a wider grid, and too numeric rules
 * out a data row.
 *
 * Duplicate names are legal and common, so they don't reject here — `table.ts`
 * suffixes them instead.
 */
function couldBeHeader(row: string[], width: number): boolean {
  const filled = row.map((value) => value.trim()).filter(Boolean);

  // One value in a row is a title. Column names come in sets.
  if (filled.length < 2) return false;

  const coverage = width === 0 ? 1 : Math.min(filled.length / width, 1);
  if (coverage < MIN_COVERAGE) return false;

  const textual =
    filled.filter((value) => value.length <= 40 && !isNumeric(value)).length /
    filled.length;

  return textual >= MIN_TEXTUAL;
}

/**
 * The share of columns that hold one kind of thing below this row.
 *
 * "One kind" is only numeric versus not, because that is the distinction a stray
 * text row in a numeric column always trips, and judging it needs no knowledge
 * of what the column means. Columns with too little under them abstain rather
 * than vote — a single value is homogeneous by definition and would flatter
 * every candidate equally.
 */
function coherenceBelow(cells: string[][], index: number, width: number): number {
  const below = cells.slice(index + 1, index + 1 + COHERENCE_SAMPLE);

  let considered = 0;
  let coherent = 0;

  for (let column = 0; column < width; column += 1) {
    const values = below.map((row) => (row[column] ?? "").trim()).filter(Boolean);

    if (values.length < MIN_COHERENCE_VALUES) continue;

    considered += 1;

    const numeric = values.filter(isNumeric).length;
    if (numeric === 0 || numeric === values.length) coherent += 1;
  }

  // Nothing measurable below — neither evidence for nor against, so sit at the
  // midpoint and let informativeness and earliness decide.
  if (considered === 0) return 0.5;

  // Same midpoint, approached rather than jumped to: a candidate with only a
  // couple of rows under it has barely been tested, and says so.
  const evidence = Math.min(below.length / CONFIDENT_COHERENCE_ROWS, 1);

  return 0.5 + (coherent / considered - 0.5) * evidence;
}

/** The share of this row's cells that read as a field name we recognise. */
function informativeness(row: string[]): number {
  const filled = row.map((value) => value.trim()).filter(Boolean);
  if (filled.length === 0) return 0;

  return filled.filter(namesAField).length / filled.length;
}

/**
 * Equal or prefix, never suffix and never "contains".
 *
 * `score.ts` also accepts a suffix, because there it is reading something already
 * known to be a header, where "Shop URL" ending in "url" is exactly the signal
 * wanted. Here the candidate may be an ordinary row of data, and a suffix match
 * on data is how this went wrong on a real customer file: a location called
 * "Mystery Shop" ends with the `name` synonym "shop" and a junk coordinate cell
 * reading "invalid_geo" ends with the `latlng` synonym "geo", so a data row
 * scored as informative and was taken as the column names — which loses every
 * row above it and names every column after one location.
 *
 * A prefix does not have that failure: real headers qualify their field
 * ("Street_Location", "Tel Number", "lat_coord") while values are qualified
 * before it ("Mystery Shop", "Streetwear Berlin"). Informativeness is a bonus and
 * never a requirement, so tightening it costs a real header nothing it needed.
 */
function namesAField(value: string): boolean {
  const normalized = normalizeHeader(value);
  if (!normalized) return false;

  for (const synonyms of Object.values(FIELD_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (synonym.length < MIN_SYNONYM_LENGTH) continue;

      if (normalized === synonym || normalized.startsWith(synonym)) return true;
    }
  }

  return false;
}

/** How wide the grid actually is, ignoring trailing empty columns. */
function usedWidth(rows: string[][]): number {
  let width = 0;

  for (const row of rows) {
    for (const [index, value] of row.entries()) {
      if (value.trim()) width = Math.max(width, index + 1);
    }
  }

  return width;
}

function isNumeric(value: string): boolean {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  return normalized !== "" && Number.isFinite(Number(normalized));
}
