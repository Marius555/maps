"use client";

import { CoordinateFields } from "@/components/places/coordinate-fields";
import { roundCoord } from "@/lib/map/geo";
import { FormSection } from "./form-section";

/**
 * Latitude and longitude, folded away.
 *
 * These are not a field anybody fills in — they are the escape hatch for a pin
 * the geocoder put in the wrong country, when the address search has failed and
 * the map is showing empty ocean. Two boxes of digits in the middle of the
 * always-open essentials made that rare case look like a required step, and put
 * it between the address and the category, which are not.
 *
 * `CoordinateFields` itself is unchanged and still shared with the import review
 * step, which shows it inline: there the numbers *are* the subject of the row.
 */
export function CoordinatesSection({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (coords: { lat: number; lng: number }) => void;
}) {
  return (
    <FormSection
      title="Coordinates"
      summary={`${roundCoord(lat)}, ${roundCoord(lng)}`}
    >
      <CoordinateFields lat={lat} lng={lng} onChange={onChange} />

      <p className="text-xs text-muted">
        Only needed when the pin is in the wrong place and the address search
        can&rsquo;t find it. Dragging the pin on the map above writes these too.
      </p>
    </FormSection>
  );
}
