import { IMPORT_FIELDS, type ImportField } from "../fields";
import { SAMPLE_ROWS } from "../limits";
import type { SourceRow } from "../table";
import { normalizeHeader } from "./normalize";
import { FIELD_SYNONYMS } from "./synonyms";
import { summarizeColumn, valueScore, type ColumnStats } from "./value-signals";

/**
 * Which column feeds which field. Absent key means "don't import this field".
 *
 * Keyed by field rather than by header so the UI can render one row per field
 * with a header picker, and so two fields can never claim the same column by
 * accident — the mapping is validated before it is used.
 */
export type ColumnMapping = Partial<Record<ImportField, string>>;

export type Confidence = "confident" | "likely" | "guess" | "none";

export type FieldDetection = {
  header: string | undefined;
  confidence: Confidence;
  /** Why we think so, in the user's words. Shown under the picker. */
  reason: string | null;
  /** Runners-up for this field, best first. Kept as headers — see `byHeader`. */
  alternatives: string[];
};

/**
 * One thing a given column could be, and how good a fit it is.
 *
 * The mirror image of `FieldDetection`. That answers "which column is the Name?"
 * and this answers "what could this column be?", which is the question the
 * mapping step actually asks now: there is one picker per column of the file,
 * and it lists our fields, not their headers.
 */
export type HeaderSuggestion = {
  field: ImportField;
  score: number;
  confidence: Confidence;
  /** Why, in the user's words. Shown under the option. */
  reason: string;
};

export type DetectionResult = {
  mapping: ColumnMapping;
  detail: Partial<Record<ImportField, FieldDetection>>;
  /**
   * Per column, the fields it could plausibly hold, best first.
   *
   * Independent of `mapping` and of what the user has done since: it describes
   * the file, so it stays valid for the whole step and is what lets the picker
   * put the likely answers at the top instead of listing fourteen identical
   * rows. Everything above `FLOOR` is here, including the candidates the greedy
   * pass rejected — a column that lost Name to a better one is still the second
   * best Name in the file, which is exactly what someone correcting us wants.
   */
  byHeader: Record<string, HeaderSuggestion[]>;
};

type Candidate = {
  field: ImportField;
  header: string;
  score: number;
  fromHeader: boolean;
  fromValues: boolean;
  /** False when the evidence is only good enough to suggest, never to decide. */
  assignable: boolean;
};

const CONFIDENT = 0.8;
const LIKELY = 0.55;
/** Below this a field is left blank, but the column is still offered as an option. */
const ASSIGN = 0.45;
/** Below this the column isn't even worth suggesting. */
const FLOOR = 0.2;

/**
 * Fields whose values carry a signature of their own.
 *
 * The rest — name, address, city, state, postcode — are all "short text" or
 * "short alphanumeric code", which describes an internal reference, a SKU, a
 * sales rep and half the other columns in a real export. For those, values are
 * corroborating evidence and the header has to agree before we fill anything in;
 * guessing that "Internal Ref" is a postcode because it looks like one is how a
 * confident-looking mapping ends up wrong.
 */
const SELF_EVIDENT: ReadonlySet<ImportField> = new Set<ImportField>([
  "email",
  "url",
  "phone",
  "lat",
  "lng",
  "latlng",
  "country",
  "category",
  "description",
]);

/**
 * Best-effort mapping from the file itself.
 *
 * A guess the user then confirms, never a silent decision — the mapping step
 * always shows what was detected and how sure we are (CLAUDE.md §7).
 *
 * Two independent kinds of evidence are combined: what a column is *called* and
 * what it *contains*. Either alone is unreliable. Headers lie or are missing
 * outright; values are ambiguous between fields that look alike. Together they
 * disambiguate each other — "Column 4" full of things between -90 and 90 with
 * four decimals is a latitude, and a column called "Latitude" holding 51.5 is a
 * latitude even in a file where every other header is junk.
 */
export function detectColumns(
  headers: string[],
  rows: SourceRow[],
): DetectionResult {
  const sample = rows.slice(0, SAMPLE_ROWS);
  const stats = new Map<string, ColumnStats>(
    headers.map((header) => [
      header,
      summarizeColumn(
        header,
        sample.map((row) => row[header] ?? ""),
      ),
    ]),
  );

  const candidates: Candidate[] = [];

  for (const field of IMPORT_FIELDS) {
    for (const header of headers) {
      const columnStats = stats.get(header);
      if (!columnStats) continue;

      // An empty column can't feed anything, and letting it match on its name
      // alone fills a field with blanks that look mapped.
      if (columnStats.values.length === 0) continue;

      const headerScore = scoreHeader(header, field);
      const values = valueScore(field, columnStats);

      const score = combine(headerScore, values);
      if (score < FLOOR) continue;

      candidates.push({
        field,
        header,
        score,
        fromHeader: headerScore > 0,
        fromValues: values >= 0.5,
        assignable:
          score >= ASSIGN && (headerScore > 0 || SELF_EVIDENT.has(field)),
      });
    }
  }

  // Highest score first, so a greedy pass assigns the confident matches before
  // the vague ones can steal a column.
  candidates.sort((a, b) => b.score - a.score);

  const mapping: ColumnMapping = {};
  const detail: DetectionResult["detail"] = {};
  const takenHeaders = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate.assignable) continue;
    if (mapping[candidate.field] !== undefined) continue;
    if (takenHeaders.has(candidate.header)) continue;

    mapping[candidate.field] = candidate.header;
    takenHeaders.add(candidate.header);

    detail[candidate.field] = {
      header: candidate.header,
      confidence: confidenceOf(candidate),
      reason: reasonFor(candidate),
      alternatives: [],
    };
  }

  // Runners-up for the fields we did place, and the near-misses for the ones we
  // didn't. Kept field-first; `byHeader` below is the same data column-first,
  // which is the axis the picker reads.
  for (const field of IMPORT_FIELDS) {
    const alternatives = candidates
      .filter(
        (candidate) =>
          candidate.field === field && candidate.header !== mapping[field],
      )
      .map((candidate) => candidate.header);

    const existing = detail[field];

    if (existing) {
      existing.alternatives = dedupe(alternatives).slice(0, 3);
      continue;
    }

    if (alternatives.length > 0) {
      detail[field] = {
        header: undefined,
        confidence: "none",
        reason: null,
        alternatives: dedupe(alternatives).slice(0, 3),
      };
    }
  }

  return { mapping, detail, byHeader: groupByHeader(candidates) };
}

/**
 * The candidate list, re-keyed by column instead of by field.
 *
 * Built from the same array the assignment pass consumed, which is already
 * sorted by score, so each column's list comes out best-first for free.
 *
 * Capped per column because the point is to shorten the question, not to
 * reproduce the whole field list above the whole field list — past four the
 * ranked section stops being a shortlist.
 */
const SUGGESTIONS_PER_HEADER = 4;

function groupByHeader(
  candidates: Candidate[],
): Record<string, HeaderSuggestion[]> {
  const byHeader: Record<string, HeaderSuggestion[]> = {};

  for (const candidate of candidates) {
    const suggestions = (byHeader[candidate.header] ??= []);
    if (suggestions.length >= SUGGESTIONS_PER_HEADER) continue;

    suggestions.push({
      field: candidate.field,
      score: candidate.score,
      confidence: confidenceOf(candidate),
      reason: reasonFor(candidate),
    });
  }

  return byHeader;
}

/**
 * Header and values, weighted so that agreement beats either alone.
 *
 * The maximum of the two is the floor — one strong signal is enough to place a
 * field — and agreement adds a bonus on top, which is what pushes a column
 * called "Latitude" that actually holds latitudes into "confident" while a
 * column called "Latitude" holding shop names stays a guess.
 */
function combine(headerScore: number, values: number): number {
  const strongest = Math.max(headerScore, values);
  const weakest = Math.min(headerScore, values);

  return Math.min(strongest + weakest * 0.35, 1);
}

/**
 * 0 for no match; higher for a more specific synonym at a stronger tier.
 *
 * Tiers are computed across all synonyms rather than returned from the first
 * one that matches, so a weak suffix hit on an early synonym can't beat a strong
 * prefix hit on a later one.
 */
function scoreHeader(header: string, field: ImportField): number {
  const normalized = normalizeHeader(header);
  if (!normalized) return 0;

  const synonyms = FIELD_SYNONYMS[field];
  let best = 0;

  for (const [index, synonym] of synonyms.entries()) {
    // Earlier synonyms are more specific, so they edge out later ones within a
    // tier without ever crossing into the tier above.
    const specificity = 1 - index / (synonyms.length * 4);

    let tier = 0;
    if (normalized === synonym) tier = 0.95;
    // Only prefix and suffix, not "contains": "contains" makes "email" match
    // "emailaddress" and "address" match it too, and the loser is arbitrary.
    else if (normalized.startsWith(synonym)) tier = 0.7;
    else if (normalized.endsWith(synonym)) tier = 0.55;

    if (tier > 0) best = Math.max(best, tier * specificity);
  }

  return best;
}

/**
 * Only agreement earns "confident".
 *
 * A column called "Latitude" that holds shop names scores high on its header
 * alone, and calling that confident is exactly the kind of guess the badge
 * exists to warn about. One source of evidence tops out at "likely".
 */
function confidenceOf(candidate: Candidate): Confidence {
  const corroborated = candidate.fromHeader && candidate.fromValues;

  if (corroborated && candidate.score >= CONFIDENT) return "confident";
  if (candidate.score >= LIKELY) return "likely";
  return "guess";
}

function reasonFor(candidate: Candidate): string {
  if (candidate.fromHeader && candidate.fromValues) {
    return "The column name and its values both match.";
  }

  if (candidate.fromValues) return "The values in this column look right.";
  return "Matched on the column name.";
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
