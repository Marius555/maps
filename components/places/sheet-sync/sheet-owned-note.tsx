"use client";

import { Sheet } from "lucide-react";

import { useSheetLink } from "@/lib/query/sheet-link";
import type { Place } from "@/lib/repositories/types";
import { describeSheetOwnedFields } from "@/lib/sheet-sync/describe";

/**
 * One line at the top of Edit location, for a location its sheet is in charge of.
 *
 * The sheet wins on every field a column feeds, and an edit here to one of those
 * lasts until the next sync — which is daily, so it would look like the app
 * losing work. Saying which fields, up front, turns that into a known rule.
 * Everything *not* named here is the app's to keep.
 *
 * Nothing at all for a location added by hand, or on a map that is not linked
 * (a key with no link behind it is inert).
 */
export function SheetOwnedNote({ place }: { place: Place }) {
  // Only asked about for a location that came from a sheet, so opening one added
  // by hand costs no request.
  const { data: link } = useSheetLink(place.mapId, undefined, {
    enabled: Boolean(place.sourceKey),
  });

  if (!place.sourceKey || !link) return null;

  const fields = describeSheetOwnedFields(link.mapping);
  const isOne = !fields.includes(" and ");

  return (
    <p className="flex items-start gap-2 px-6 text-xs text-muted">
      <Sheet aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span className="text-pretty">
        {fields} {isOne ? "comes" : "come"} from your Google Sheet and{" "}
        {isOne ? "is" : "are"} replaced on the next sync. Change{" "}
        {isOne ? "it" : "them"} in the sheet.
      </span>
    </p>
  );
}
