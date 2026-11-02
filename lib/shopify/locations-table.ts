import type { SourceTable } from "@/lib/import/sources/types";

/**
 * The shop's own Shopify locations as an import table (docs/notes/shopify.md,
 * "Import from Shopify").
 *
 * Shaped like any other source — a header row, then one row per location — so
 * everything after it is the import every file goes through: the columns are
 * detected, the merchant can check the mapping, review the rows and import.
 * The headers are words the detector already knows (`detect/synonyms.ts`), and
 * the coordinates Shopify keeps for each location come along, so a location
 * with them costs no address lookup at all.
 *
 * Pure, so the shape is tested against the real detector.
 */

/** One location as the Admin API's `locations` query answers it. */
export type ShopifyLocationNode = {
  name: string;
  isFulfillmentService: boolean;
  address: {
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    zip: string | null;
    country: string | null;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

export const SHOPIFY_LOCATION_HEADERS = [
  "Name",
  "Address",
  "City",
  "Region",
  "Postcode",
  "Country",
  "Phone",
  "Latitude",
  "Longitude",
] as const;

/**
 * Whether a location is a place a customer could visit. A fulfillment
 * service's location is an app's warehouse with no address of its own, and a
 * location with neither an address nor coordinates has nowhere to put a pin.
 */
export function isMappableLocation(node: ShopifyLocationNode): boolean {
  if (node.isFulfillmentService || !node.address) return false;

  const { address1, city, zip, latitude, longitude } = node.address;
  return Boolean(address1?.trim() || city?.trim() || zip?.trim() || (latitude !== null && longitude !== null));
}

export function shopifyLocationsTable(nodes: readonly ShopifyLocationNode[], label = "Shopify locations"): SourceTable {
  const rows = nodes.filter(isMappableLocation).map((node) => {
    const address = node.address!;
    const street = [address.address1, address.address2].map((part) => part?.trim()).filter(Boolean).join(", ");

    return [
      node.name.trim(),
      street,
      address.city?.trim() ?? "",
      address.province?.trim() ?? "",
      address.zip?.trim() ?? "",
      address.country?.trim() ?? "",
      address.phone?.trim() ?? "",
      coordinate(address.latitude, address.longitude, "lat"),
      coordinate(address.latitude, address.longitude, "lng"),
    ];
  });

  return {
    label,
    cells: [[...SHOPIFY_LOCATION_HEADERS], ...rows],
    // A header row we wrote ourselves, not a guess (`SourceTable.headerRowIndex`).
    headerRowIndex: 0,
    truncated: false,
  };
}

/**
 * One half of a coordinate pair, or "" for both when either is missing or the
 * pair is Shopify's unset 0,0 — a half pair would place a pin nowhere, and the
 * address is then looked up as for any other row.
 */
function coordinate(lat: number | null, lng: number | null, half: "lat" | "lng"): string {
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  if (lat === 0 && lng === 0) return "";

  return String(half === "lat" ? lat : lng);
}
