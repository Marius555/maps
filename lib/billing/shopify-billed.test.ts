import { describe, expect, it } from "vitest";

import { isShopifyBilled, refuseShopifyBilled } from "./shopify-billed";

/**
 * Which rows the Lemon billing routes must leave alone. The expensive mistake
 * is a Shopify shop reaching Lemon's cancel or checkout: off-platform billing
 * is an App Store rejection (1.2.1), and the call fails anyway.
 */
describe("isShopifyBilled", () => {
  it("is true only for a row Shopify bills", () => {
    expect(isShopifyBilled({ provider: "shopify" })).toBe(true);
    expect(isShopifyBilled({ provider: "lemon" })).toBe(false);
  });

  it("reads an absent provider as Lemon — every row written before Shopify", () => {
    expect(isShopifyBilled({})).toBe(false);
    expect(isShopifyBilled(null)).toBe(false);
    expect(isShopifyBilled(undefined)).toBe(false);
  });
});

describe("refuseShopifyBilled", () => {
  it("answers 409 for a Shopify row and nothing otherwise", async () => {
    const refused = refuseShopifyBilled({ provider: "shopify" });

    expect(refused?.status).toBe(409);
    expect((await refused?.json())?.error.code).toBe("conflict");
    expect(refuseShopifyBilled({ provider: "lemon" })).toBeNull();
    expect(refuseShopifyBilled(null)).toBeNull();
  });
});
