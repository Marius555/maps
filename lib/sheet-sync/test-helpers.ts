import type { ColumnMapping } from "@/lib/import/column-mapping";
import { buildDraftPlaces, type DraftPlace } from "@/lib/import/draft-places";
import type { SourceRow } from "@/lib/import/table";
import type { SheetRow } from "./diff";
import type { PatchablePlace } from "./patch";
import { sourceKeysFor } from "./row-key";

/** The mapping a plain name/address/phone/tags sheet detects to. */
export const BASIC_MAPPING: ColumnMapping = {
  name: "Name",
  address: "Address",
  phone: "Phone",
  tags: "Tags",
};

/** Real drafts, built the way a sync builds them, from rows keyed by header. */
export function draftsFrom(
  rows: SourceRow[],
  mapping: ColumnMapping = BASIC_MAPPING,
): DraftPlace[] {
  return buildDraftPlaces(rows, mapping).drafts;
}

export function sheetRowsFrom(
  rows: SourceRow[],
  mapping: ColumnMapping = BASIC_MAPPING,
): SheetRow[] {
  const drafts = draftsFrom(rows, mapping);
  const keys = sourceKeysFor(drafts);

  return drafts.map((draft, index) => ({ key: keys[index], draft }));
}

let nextId = 1;

/** A stored, sheet-linked location, keyed the way the import would have. */
export function linkedPlace(
  overrides: Partial<PatchablePlace> & { name: string; address: string },
): PatchablePlace & { id: string; sourceKey: string } {
  const [sourceKey] = sourceKeysFor([overrides]);

  return {
    id: `place-${nextId++}`,
    description: null,
    phone: null,
    email: null,
    url: null,
    tags: [],
    lat: 52.52,
    lng: 13.405,
    sourceKey,
    ...overrides,
  };
}
