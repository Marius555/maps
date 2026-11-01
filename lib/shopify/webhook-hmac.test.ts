import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyWebhookHmac } from "./webhook-hmac";

const SECRET = "client-secret";
const BODY = '{"shop_id":954889,"shop_domain":"demo-shop.myshopify.com"}';

const hmac = (body: string, secret = SECRET) =>
  createHmac("sha256", secret).update(body).digest("base64");

describe("verifyWebhookHmac", () => {
  it("accepts the HMAC Shopify computes over the raw body", () => {
    expect(verifyWebhookHmac(BODY, hmac(BODY), SECRET)).toBe(true);
  });

  it("refuses a body that was re-serialised, even with the same data", () => {
    const reformatted = JSON.stringify(JSON.parse(BODY), null, 1);

    expect(verifyWebhookHmac(reformatted, hmac(BODY), SECRET)).toBe(false);
  });

  it("refuses a signature made with another secret", () => {
    expect(verifyWebhookHmac(BODY, hmac(BODY, "other"), SECRET)).toBe(false);
  });

  it("refuses everything while the secret is unset", () => {
    expect(verifyWebhookHmac(BODY, hmac(BODY, ""), "")).toBe(false);
  });

  it("refuses a missing or garbage header", () => {
    expect(verifyWebhookHmac(BODY, null, SECRET)).toBe(false);
    expect(verifyWebhookHmac(BODY, "not base64 at all!", SECRET)).toBe(false);
  });
});
