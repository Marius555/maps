import type { Place } from "@/lib/repositories/types";
import { isPlaceholderName } from "./next-place-defaults";

/**
 * The quieter line under a location's address, in the list and on the map card.
 *
 * The address above it says where the place is. This line says *which* place,
 * and it has three things competing for one narrow row:
 *
 * - **The postcode**, which the address line deliberately leaves out — it is
 *   precise but not what anyone reads a row by, so it leads here instead.
 * - **The venue's name**, when the geocoder matched something with one. A pin on
 *   the Vytautas Kasiulis Museum of Art is far easier to recognise by the museum
 *   than by "A. Goštauto g. 1", but the museum is not an address and does not
 *   belong on the line that has to be one.
 * - **The customer's own name for it**, once they type one.
 *
 * Their name wins over the venue's. They renamed it for a reason, and
 * "01104 · Corner Shop · Vytautas Kasiulis Museum of Art" is three names for one
 * row. The placeholder we invented — "Location 3" — counts as no name at all: it
 * is the thing this whole line was rewritten to stop showing.
 *
 * Empty when there is nothing true to say, so callers render no line rather than
 * an empty one. That is an old row whose parts predate the column, and it will
 * fill itself in the next time the pin is resolved.
 */
export function placeSecondLine(place: Place): string {
  const postcode = place.addressParts?.postcode;
  const ownName = isPlaceholderName(place.name) ? undefined : place.name;
  const venueName = place.addressParts?.name;

  return [postcode, ownName ?? venueName].filter(Boolean).join(" · ");
}
