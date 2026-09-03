/**
 * The fields a column can be mapped onto.
 *
 * Wider than the `places` columns on purpose: real stockist and dealer exports
 * almost never have one tidy "address" column. They have Street / City / Postcode
 * / Country, and a geocoder needs those joined back together. The address parts
 * are composed into the single `address` field on save — they are not stored
 * separately (CLAUDE.md §6 has no columns for them, and adding some would buy
 * nothing we query on).
 */

export const IMPORT_FIELDS = [
  "name",
  "address",
  "city",
  "postcode",
  "state",
  "country",
  "category",
  "tags",
  "description",
  "phone",
  "email",
  "url",
  "lat",
  "lng",
  "latlng",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Joined, in this order, to form the address we geocode and store. */
export const ADDRESS_PARTS = [
  "address",
  "city",
  "state",
  "postcode",
  "country",
] as const satisfies readonly ImportField[];

/** Without a name there is nothing to label a pin with. */
export const REQUIRED_FIELDS = ["name"] as const satisfies readonly ImportField[];

/**
 * Fields that answer "where is this?".
 *
 * At least one route to a position has to exist, and when none does the mapping
 * step refuses to continue — this is the set it checks.
 */
export const LOCATION_FIELDS = [
  "address",
  "city",
  "postcode",
  "state",
  "country",
  "lat",
  "lng",
  "latlng",
] as const satisfies readonly ImportField[];

export const FIELD_LABELS: Record<ImportField, string> = {
  name: "Name",
  address: "Street address",
  city: "City",
  postcode: "Postcode",
  state: "State or region",
  country: "Country",
  category: "Main tag",
  tags: "Tags",
  description: "Description",
  phone: "Phone",
  email: "Email",
  url: "Website",
  lat: "Latitude",
  lng: "Longitude",
  latlng: "Latitude and longitude together",
};

/** Shown under the picker, for the fields whose purpose isn't self-evident. */
export const FIELD_HINTS: Partial<Record<ImportField, string>> = {
  latlng: 'One column holding both, like "52.5200, 13.4050" or a map link.',
  category: "One per row. Goes first, so it colours the pin.",
  tags: "Extra filters. One column, several tags per row, separated by , ; or |.",
  lat: "Between -90 and 90.",
  lng: "Between -180 and 180.",
};
