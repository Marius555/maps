import type { ColumnMapping } from "@/lib/import/column-mapping";

/**
 * The mapping a sync will replay against the live sheet, from the one the
 * import's mapping step ended with.
 *
 * They differ in one case. Splitting a combined coordinate column in the mapping
 * step makes two new columns — "Latitude" and "Longitude" — that exist in this
 * run's copy of the rows and nowhere in the sheet; a sync looking for them would
 * report both gone. The combined column reads correctly as it is (splitting it
 * was only ever for legibility), so the link stores that instead.
 */
export function mappingForLink(
  mapping: ColumnMapping,
  split: { sourceHeader?: string; latHeader: string; lngHeader: string } | null,
): ColumnMapping {
  if (!split?.sourceHeader) return { ...mapping };

  const synthetic = new Set([split.latHeader, split.lngHeader]);
  const usesSplit =
    (mapping.lat !== undefined && synthetic.has(mapping.lat)) ||
    (mapping.lng !== undefined && synthetic.has(mapping.lng));

  if (!usesSplit) return { ...mapping };

  const next: ColumnMapping = { ...mapping, latlng: split.sourceHeader };
  delete next.lat;
  delete next.lng;

  return next;
}
