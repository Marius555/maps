/**
 * The fields a CSV column can be mapped onto.
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
  "description",
  "phone",
  "email",
  "url",
  "lat",
  "lng",
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

export const FIELD_LABELS: Record<ImportField, string> = {
  name: "Name",
  address: "Street address",
  city: "City",
  postcode: "Postcode",
  state: "State or region",
  country: "Country",
  category: "Category",
  description: "Description",
  phone: "Phone",
  email: "Email",
  url: "Website",
  lat: "Latitude",
  lng: "Longitude",
};

/**
 * Header spellings we recognise, normalised. Ordered most to least specific
 * within a field, because the first match wins.
 */
export const FIELD_SYNONYMS: Record<ImportField, readonly string[]> = {
  name: [
    "name",
    "locationname",
    "storename",
    "shopname",
    "businessname",
    "companyname",
    "dealername",
    "stockist",
    "venue",
    "location",
    "store",
    "shop",
    "business",
    "company",
    "dealer",
    "title",
    "label",
  ],
  address: [
    "streetaddress",
    "addressline1",
    "address1",
    "addressline",
    "fulladdress",
    "address",
    "street",
    "addr",
    "road",
  ],
  city: ["city", "town", "locality", "suburb", "posttown"],
  postcode: ["postcode", "postalcode", "zipcode", "zip", "plz", "cp"],
  state: ["state", "province", "region", "county", "district"],
  country: ["country", "countrycode", "nation"],
  category: ["category", "type", "kind", "group", "segment", "tag", "classification"],
  description: ["description", "about", "notes", "details", "summary", "info"],
  phone: ["phone", "phonenumber", "telephone", "tel", "mobile", "contactnumber"],
  email: ["email", "emailaddress", "mail", "contactemail"],
  url: ["url", "website", "web", "homepage", "link", "site", "webaddress"],
  lat: ["latitude", "lat", "ycoordinate", "y"],
  lng: ["longitude", "lng", "long", "lon", "xcoordinate", "x"],
};

/** Strips case, spaces, and punctuation so "Store Name" matches "store_name". */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}
