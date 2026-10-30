import { describe, expect, it } from "vitest";

import { redactEventUrls, redactInviteTokens } from "./redact";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-ABCD";

describe("redactInviteTokens", () => {
  it("cuts the token out of an invite page's address", () => {
    expect(redactInviteTokens(`https://pinglide.com/invite/${TOKEN}`)).toBe(
      "https://pinglide.com/invite/[redacted]",
    );
  });

  it("cuts it out of the encoded `next` the login and signup pages carry", () => {
    const url = `https://pinglide.com/login?next=%2Finvite%2F${TOKEN}`;

    expect(redactInviteTokens(url)).not.toContain(TOKEN);
  });

  it("leaves every other address exactly as it was", () => {
    const url = "https://pinglide.com/maps/abc/places?filter=failed";

    expect(redactInviteTokens(url)).toBe(url);
  });
});

describe("redactEventUrls", () => {
  it("covers every property PostHog fills from the address bar", () => {
    const event = redactEventUrls({
      properties: {
        $current_url: `https://pinglide.com/invite/${TOKEN}`,
        $pathname: `/invite/${TOKEN}`,
        $referrer: `https://pinglide.com/invite/${TOKEN}`,
        $initial_referrer: `https://pinglide.com/invite/${TOKEN}`,
        other: TOKEN,
      },
    });

    expect(JSON.stringify(event.properties).match(new RegExp(TOKEN, "g"))).toHaveLength(1);
    expect(event.properties.other).toBe(TOKEN);
  });
});
