import { describe, expect, it } from "vitest";

import { detectColumns } from "@/lib/import/detect/score";
import { buildDraftPlaces, importableDrafts } from "@/lib/import/draft-places";
import { planGeocode } from "@/lib/import/geocode-plan";
import { buildTable } from "@/lib/import/table";
import { shopifyLocationsTable, type ShopifyLocationNode } from "./locations-table";

const store = (overrides: Partial<NonNullable<ShopifyLocationNode["address"]>> = {}, name = "Ottawa store"): ShopifyLocationNode => ({
  name,
  isFulfillmentService: false,
  address: {
    address1: "50 Rideau Street",
    address2: null,
    city: "Ottawa",
    province: "Ontario",
    zip: "K1N 9J7",
    country: "Canada",
    phone: "+1 613 555 0100",
    latitude: 45.4266,
    longitude: -75.6919,
    ...overrides,
  },
});

/** Through the import every file takes: table → detection → drafts → lookups. */
function run(nodes: ShopifyLocationNode[]) {
  const table = buildTable(shopifyLocationsTable(nodes));
  const detection = detectColumns(table.headers, table.rows);
  const { drafts } = buildDraftPlaces(table.rows, detection.mapping);

  return { mapping: detection.mapping, drafts, plan: planGeocode(drafts) };
}

describe("shopifyLocationsTable", () => {
  it("is mapped column for column by the detector, with nothing for the merchant to fix", () => {
    const { mapping } = run([store()]);

    expect(mapping).toMatchObject({
      name: "Name",
      address: "Address",
      city: "City",
      state: "Region",
      postcode: "Postcode",
      country: "Country",
      phone: "Phone",
      lat: "Latitude",
      lng: "Longitude",
    });
  });

  it("places a location Shopify has coordinates for without a single address lookup", () => {
    const { drafts, plan } = run([store(), store({ latitude: 43.6532, longitude: -79.3832 }, "Toronto store")]);

    expect(plan.lookupCount).toBe(0);
    expect(importableDrafts(drafts)).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ name: "Ottawa store", lat: 45.4266, lng: -75.6919, phone: "+1 613 555 0100" });
    expect(drafts[0].address).toContain("50 Rideau Street");
  });

  it("looks the address up when Shopify has no coordinates, or only its unset 0,0", () => {
    const { plan } = run([store({ latitude: null, longitude: null }), store({ latitude: 0, longitude: 0 }, "Second")]);

    expect(plan.rowCount).toBe(2);
  });

  it("leaves out an app's fulfillment warehouse and a location with nowhere to put a pin", () => {
    const table = shopifyLocationsTable([
      store(),
      { ...store({}, "Shipwire"), isFulfillmentService: true },
      store({ address1: null, city: null, zip: null, latitude: null, longitude: null }, "Nowhere"),
      { name: "No address", isFulfillmentService: false, address: null },
    ]);

    expect(table.cells.map((row) => row[0])).toEqual(["Name", "Ottawa store"]);
  });

  it("joins both street lines into one address", () => {
    const table = shopifyLocationsTable([store({ address2: "Unit 4" })]);

    expect(table.cells[1][1]).toBe("50 Rideau Street, Unit 4");
  });
});
