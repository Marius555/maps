import { describe, expect, it } from "vitest";

import { frameAncestorsFor, parseShopDomain, storeHandle } from "./shop-domain";

describe("parseShopDomain", () => {
  it("accepts a myshopify domain and lower-cases it", () => {
    expect(parseShopDomain("demo-shop.myshopify.com")).toBe("demo-shop.myshopify.com");
    expect(parseShopDomain(" Demo-Shop.MyShopify.com ")).toBe("demo-shop.myshopify.com");
  });

  it("refuses anything that is not exactly a shop domain", () => {
    for (const value of [
      "",
      "myshopify.com",
      "-shop.myshopify.com",
      "shop.myshopify.com.evil.example",
      "evil.example",
      "shop.myshopify.com/admin",
      "https://shop.myshopify.com",
      "shop.myshopify.com:443",
      "admin.shopify.com/store/shop",
      "sh op.myshopify.com",
      null,
      42,
    ]) {
      expect(parseShopDomain(value), String(value)).toBeNull();
    }
  });
});

describe("storeHandle", () => {
  it("is the domain's first label", () => {
    expect(storeHandle("demo-shop.myshopify.com")).toBe("demo-shop");
  });
});

describe("frameAncestorsFor", () => {
  it("names the shop and Shopify's admin", () => {
    const value = frameAncestorsFor("demo-shop.myshopify.com");

    expect(value).toContain("https://demo-shop.myshopify.com");
    expect(value).toContain("https://admin.shopify.com");
    expect(value).not.toContain("'self'");
  });
});
