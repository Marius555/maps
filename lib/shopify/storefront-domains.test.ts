import { describe, expect, it } from "vitest";

import { hostsMissing } from "./storefront-domains";

describe("hostsMissing", () => {
  it("misses nothing on an open list, which means every site", () => {
    expect(hostsMissing([], ["demo.myshopify.com", "shop.example.com"])).toEqual([]);
  });

  it("names a custom domain connected after the map went on the storefront", () => {
    expect(
      hostsMissing(["demo.myshopify.com"], ["demo.myshopify.com", "www.brand.com"]),
    ).toEqual(["www.brand.com"]);
  });

  it("lets a subdomain through when its parent is listed, as the embed does", () => {
    expect(hostsMissing(["brand.com", "demo.myshopify.com"], ["www.brand.com", "demo.myshopify.com"])).toEqual([]);
  });

  it("names each host once and ignores empty ones", () => {
    expect(hostsMissing(["other.com"], ["demo.myshopify.com", "demo.myshopify.com", ""])).toEqual([
      "demo.myshopify.com",
    ]);
  });
});
