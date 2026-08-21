import {
  AlignLeft,
  Clock,
  Globe,
  Image,
  Mail,
  Phone,
  type LucideIcon,
} from "lucide-react";

import {
  describeMissing,
  missingFields,
  type OptionalField,
} from "@/lib/places/completeness";
import type { Place } from "@/lib/repositories/types";

/**
 * What this location still hasn't got.
 *
 * Only the *missing* fields are drawn, never the present ones. A row of six icons
 * where four are lit is a puzzle you decode twice — once to see which are on,
 * once to remember what on means — and it puts the same amount of ink on a
 * finished location as on an empty one. Marking only the gaps makes a complete
 * row visibly quiet and an incomplete one countable at a glance, which is the
 * question the Locations tab could not answer at all before: nothing on the page
 * said whether a place had a phone number without opening it.
 *
 * These are absences, not errors. Nothing here stops a location publishing, so
 * they are muted glyphs rather than anything wearing a status colour — those are
 * spoken for by `PlaceStatusFlag`, and a missing photo must not look like a pin
 * in the wrong country.
 *
 * Which fields count is `lib/places/completeness.ts`, shared with the filter that
 * finds them.
 */

const ICONS: Record<OptionalField, LucideIcon> = {
  phone: Phone,
  email: Mail,
  url: Globe,
  photo: Image,
  hours: Clock,
  description: AlignLeft,
};

/** More than this and the row is a wall of glyphs, so the rest are counted. */
const MAX_GLYPHS = 4;

export function PlaceCompleteness({ place }: { place: Place }) {
  const missing = missingFields(place);

  if (missing.length === 0) return null;

  const shown = missing.slice(0, MAX_GLYPHS);
  const rest = missing.length - shown.length;
  const label = describeMissing(missing);

  return (
    <span className="flex items-center gap-1 text-muted" title={label}>
      {/* One label for the group. Six separately-labelled icons would make a
          screen reader read the row's shortcomings one glyph at a time. */}
      <span className="sr-only">{label}</span>

      {shown.map((field) => {
        const Icon = ICONS[field];
        return <Icon key={field} aria-hidden="true" className="size-3.5" />;
      })}

      {rest > 0 ? (
        <span aria-hidden="true" className="text-xs tabular-nums">
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
