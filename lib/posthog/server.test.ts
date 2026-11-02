import { describe, expect, it } from "vitest";

import { serverEventBody } from "./server";

describe("serverEventBody", () => {
  it("is the shape PostHog's capture API takes", () => {
    expect(
      serverEventBody("phc_key", "workspace-1", "user_signed_up", {
        method: "shopify",
        $set: { platform: "shopify" },
      }),
    ).toEqual({
      api_key: "phc_key",
      event: "user_signed_up",
      distinct_id: "workspace-1",
      properties: { method: "shopify", $set: { platform: "shopify" } },
    });
  });

  it("sends empty properties rather than none", () => {
    expect(serverEventBody("phc_key", "w", "e").properties).toEqual({});
  });
});
