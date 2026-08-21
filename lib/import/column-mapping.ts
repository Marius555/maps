import { IMPORT_FIELDS, FIELD_LABELS, type ImportField } from "./fields";

export type {
  ColumnMapping,
  Confidence,
  DetectionResult,
  FieldDetection,
  HeaderSuggestion,
} from "./detect/score";
export { detectColumns } from "./detect/score";

import type { ColumnMapping } from "./detect/score";

export type MappingProblem = {
  field?: ImportField;
  message: string;
};

/**
 * What's wrong with a mapping, in the user's terms (CLAUDE.md §8: say what
 * happened and how to fix it).
 *
 * A problem carrying a `field` is one a single picker could answer; a problem
 * without one is about the file as a whole. Both are shown together in the
 * banner under the table — see `mapping-step.tsx` for why none of them is drawn
 * on the column it names.
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

  const hasPair = Boolean(mapping.lat && mapping.lng);
  const hasCombined = Boolean(mapping.latlng);
  const hasAddress = Boolean(
    mapping.address ||
      mapping.city ||
      mapping.postcode ||
      mapping.state ||
      mapping.country,
  );

  if (!hasPair && !hasCombined && !hasAddress) {
    problems.push({
      message:
        "Choose an address column, or latitude and longitude columns, so we can place each location on the map.",
    });
  }

  // One without the other is a half-mapped pair, which would silently fall back
  // to geocoding and look like the columns were ignored. A combined column
  // covers both, so it excuses the pair entirely.
  if (!hasCombined && Boolean(mapping.lat) !== Boolean(mapping.lng)) {
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
        message: `"${header}" is already used for ${FIELD_LABELS[claimedBy]}. Each column can only be used once.`,
      });
      continue;
    }

    used.set(header, field);
  }

  return problems;
}
