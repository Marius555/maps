"use client";

import { X } from "lucide-react";

import { CategoryBadge } from "@/components/categories/category-badge";
import { PlaceStatusChip } from "@/components/places/place-status-chip";
import { placeSecondLine } from "@/lib/places/place-labels";
import type { MapCategory, Place } from "@/lib/repositories/types";

/**
 * Photo, title and close button.
 *
 * The heading is the address, and that is the whole of it. It used to carry the
 * location's name underneath, which for a pin that had just been dropped meant a
 * card headed by a street with "Location 1" printed under it — a placeholder we
 * invented, quoted back at the user as if it were information. The name is the
 * customer's to write and belongs where they write it: the Locations list and the
 * edit form. A location with no address still falls back to its name here rather
 * than showing an empty line.
 *
 * The second line is the exception, and not a contradiction of that: it carries
 * the postcode and the landmark the geocoder actually found — or the name the
 * customer typed, once they have — never the placeholder. Same rule as the
 * locations list, from the same function, so the two cannot drift.
 */
export function PlaceCardHeader({
  place,
  category,
  onClose,
}: {
  place: Place;
  category: MapCategory | undefined;
  onClose: () => void;
}) {
  const title = place.address || place.name;
  const secondLine = placeSecondLine(place);

  return (
    // `shrink-0`: the card is a flex column that may hit its height cap, and the
    // photo and heading are not what should give way when it does.
    <div className="shrink-0">
      {place.photoUrl ? (
        // A plain img, not next/image, for the same reason as the edit form's
        // thumbnail (place-form/photo-field.tsx): behind auth, small, and not
        // worth a per-request transform.
        // The name is the caption right below it — repeating it as alt text
        // would make a screen reader read the place twice.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={place.photoUrl}
          alt=""
          loading="lazy"
          className="h-24 w-full object-cover"
        />
      ) : null}

      <div className="flex items-start gap-2 p-3 pb-0">
        <div className="min-w-0 flex-1">
          {/* Two lines, then an ellipsis. A full address is what this line is
              for, and truncating it after one line hid the half that says which
              town — but a card is 256px wide and a long rural address would
              otherwise push the photo and the badges apart. */}
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
            {title}
          </h3>

          {place.address && secondLine ? (
            <p className="truncate text-xs text-muted">{secondLine}</p>
          ) : null}

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {category ? <CategoryBadge category={category} size="sm" /> : null}
            <PlaceStatusChip
              status={place.geocodeStatus}
              confidence={place.geocodeConfidence}
            />
          </div>
        </div>

        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-m-1 shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-default hover:text-foreground focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
