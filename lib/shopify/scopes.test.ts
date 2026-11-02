import { describe, expect, it } from "vitest";

import { grantsScopes, LOCATIONS_SCOPE } from "./scopes";

/**
 * Whether a cached Admin API token can serve a request. Read wrong in one
 * direction and a merchant who just pressed Allow is told they did not; in the
 * other, the import calls Shopify with a token that answers "access denied".
 */
describe("grantsScopes", () => {
  it("is satisfied by nothing when nothing is required", () => {
    expect(grantsScopes("", [])).toBe(true);
  });

  it("finds a granted scope in Shopify's comma-separated list", () => {
    expect(grantsScopes("read_products,read_locations", [LOCATIONS_SCOPE])).toBe(true);
    expect(grantsScopes(" read_locations , write_orders ", [LOCATIONS_SCOPE])).toBe(true);
  });

  it("treats a write grant as covering the read", () => {
    expect(grantsScopes("write_locations", [LOCATIONS_SCOPE])).toBe(true);
  });

  it("refuses a token taken before the grant", () => {
    expect(grantsScopes("", [LOCATIONS_SCOPE])).toBe(false);
    expect(grantsScopes("read_products", [LOCATIONS_SCOPE])).toBe(false);
    // A read grant never covers a write.
    expect(grantsScopes("read_locations", ["write_locations"])).toBe(false);
  });
});
