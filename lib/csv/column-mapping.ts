import {
  FIELD_SYNONYMS,
  IMPORT_FIELDS,
  normalizeHeader,
  type ImportField,
} from "./fields";

/**
 * Which CSV header feeds which field. Absent key means "don't import this field".
 *
 * Keyed by field rather than by header so the UI can render one row per field
 * with a header picker, and so two fields can never claim the same column by
 * accident — the mapping is validated before it is used.
 */
export type ColumnMapping = Partial<Record<ImportField, string>>;

/**
 * Best-effort mapping from the file's own headers.
 *
 * A guess the user then confirms, never a silent decision — the mapping step
 * always shows what was detected. An exact synonym match beats a partial one, so
 * a file with both "address" and "email address" doesn't put the email in the
 * address field.
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const candidates: {
    field: ImportField;
    header: string;
    score: number;
  }[] = [];

  for (const field of IMPORT_FIELDS) {
    const synonyms = FIELD_SYNONYMS[field];

    for (const header of headers) {
      const normalized = normalizeHeader(header);
      if (!normalized) continue;

      const score = matchScore(normalized, synonyms);
      if (score > 0) candidates.push({ field, header, score });
    }
  }

  // Highest score first, so a greedy pass assigns the confident matches before
  // the vague ones can steal a column.
  candidates.sort((a, b) => b.score - a.score);

  const mapping: ColumnMapping = {};
  const takenHeaders = new Set<string>();

  for (const candidate of candidates) {
    if (mapping[candidate.field] !== undefined) continue;
    if (takenHeaders.has(candidate.header)) continue;

    mapping[candidate.field] = candidate.header;
    takenHeaders.add(candidate.header);
  }

  return mapping;
}

/**
 * 0 for no match. Exact synonym scores highest, and earlier synonyms outrank
 * later ones so the per-field ordering in FIELD_SYNONYMS is meaningful.
 */
function matchScore(normalizedHeader: string, synonyms: readonly string[]): number {
  for (const [index, synonym] of synonyms.entries()) {
    const rank = synonyms.length - index;

    if (normalizedHeader === synonym) return 1000 + rank;
  }

  for (const [index, synonym] of synonyms.entries()) {
    const rank = synonyms.length - index;

    // Only prefix matches, not "contains": "contains" makes "email" match
    // "emailaddress" and "address" match it too, and the loser is arbitrary.
    if (normalizedHeader.startsWith(synonym)) return 500 + rank;
    if (normalizedHeader.endsWith(synonym)) return 250 + rank;
  }

  return 0;
}

export type MappingProblem = {
  field?: ImportField;
  message: string;
};

/**
 * What's wrong with a mapping, in the user's terms (CLAUDE.md §8: say what
 * happened and how to fix it).
 */
export function validateColumnMapping(
  mapping: ColumnMapping,
  headers: string[],
): MappingProblem[] {
  const problems: MappingProblem[] = [];
  const headerSet = new Set(headers);

  if (!mapping.name) {
    problems.push({
      field: "name",
      message: "Choose which column holds the location name.",
    });
  }

  const hasCoordinates = Boolean(mapping.lat && mapping.lng);
  const hasAddress = Boolean(
    mapping.address || mapping.city || mapping.postcode || mapping.country,
  );

  if (!hasCoordinates && !hasAddress) {
    problems.push({
      message:
        "Choose an address column, or latitude and longitude columns, so we can place each location on the map.",
    });
  }

  // One without the other is a half-mapped pair, which would silently fall back
  // to geocoding and look like the columns were ignored.
  if (Boolean(mapping.lat) !== Boolean(mapping.lng)) {
    problems.push({
      field: mapping.lat ? "lng" : "lat",
      message:
        "Latitude and longitude have to be mapped together. Choose the other column, or clear both.",
    });
  }

  const used = new Map<string, ImportField>();
  for (const field of IMPORT_FIELDS) {
    const header = mapping[field];
    if (!header) continue;

    if (!headerSet.has(header)) {
      problems.push({
        field,
        message: `This file has no column called "${header}". Choose one of its columns.`,
      });
      continue;
    }

    const claimedBy = used.get(header);
    if (claimedBy) {
      problems.push({
        field,
        message: `"${header}" is already used for ${claimedBy}. Each column can only be used once.`,
      });
      continue;
    }

    used.set(header, field);
  }

  return problems;
}
