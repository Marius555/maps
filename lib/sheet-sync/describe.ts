import type { ColumnMapping } from "@/lib/import/column-mapping";
import { sheetOwnedFields } from "./patch";
import type { SheetSyncReport } from "./types";

/**
 * Which of a location's fields its sheet overwrites, as a list a sentence can
 * hold: "Name, address, phone and tags".
 *
 * Built from the same `sheetOwnedFields` a sync patches with, so the Edit
 * dialog cannot warn about a field the sync leaves alone, or miss one it takes.
 */
export function describeSheetOwnedFields(mapping: ColumnMapping): string {
  const owned = sheetOwnedFields(mapping);

  const names = [
    "name",
    owned.address ? "address" : null,
    mapping.lat || mapping.latlng ? "position" : null,
    owned.description ? "description" : null,
    owned.phone ? "phone" : null,
    owned.email ? "email" : null,
    owned.url ? "website" : null,
    owned.tags ? "tags" : null,
  ].filter((name): name is string => Boolean(name));

  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return list.charAt(0).toUpperCase() + list.slice(1);
}

/**
 * What a sync changed, as one short clause: "3 added, 1 updated, 2 removed".
 *
 * Only the counts that are not zero, in the order a person reads a list — new
 * things, changed things, gone things. "Nothing changed" when all three are,
 * which is the answer an idle daily sync gives nearly every day.
 */
export function describeSyncCounts(report: SheetSyncReport): string {
  const parts = [
    report.added > 0 ? `${report.added} added` : null,
    report.updated > 0 ? `${report.updated} updated` : null,
    report.removed > 0 ? `${report.removed} removed` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Nothing changed";
}

/** The toast's sentence after Sync now: the counts, then what happened to the live map. */
export function describeSyncResult(report: SheetSyncReport): string {
  const sentences = [`${describeSyncCounts(report)}.`];

  if (report.republished) sentences.push("Your live map was republished.");

  if (report.skippedTotal > 0) {
    sentences.push(
      `${report.skippedTotal} ${report.skippedTotal === 1 ? "row was" : "rows were"} skipped — open Sheet sync to see why.`,
    );
  }

  return sentences.join(" ");
}
