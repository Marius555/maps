import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkTurnstile, SITEVERIFY_URL } from "./verify";

/**
 * Cloudflare's answer, mapped onto pass / fail / unavailable.
 *
 * The property worth guarding is the split between the last two: `fail` refuses
 * the person, `unavailable` lets them through. A bot cannot cause an outage at
 * Cloudflare, so anything that is *our* problem or *theirs* must never become a
 * refused signup — that is the existing rule for every address check on signup.
 */

const answer = (status: number, body: unknown) =>
  vi.fn<typeof fetch>(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkTurnstile", () => {
  it("passes a token Cloudflare accepts, sending the secret, token and address", async () => {
    const fetchImpl = answer(200, { success: true, "error-codes": [] });

    await expect(
      checkTurnstile({ secret: "s3cret", token: "tok", ip: "203.0.113.7", fetchImpl }),
    ).resolves.toBe("pass");

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(SITEVERIFY_URL);
    const body = init?.body as URLSearchParams;
    expect(body.get("secret")).toBe("s3cret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("203.0.113.7");
  });

  it("never sends the placeholder address clientIp uses when there is none", async () => {
    const fetchImpl = answer(200, { success: true });

    await checkTurnstile({ secret: "s", token: "tok", ip: "unknown", fetchImpl });

    expect((fetchImpl.mock.calls[0]![1]?.body as URLSearchParams).has("remoteip")).toBe(false);
  });

  it("fails a missing, blank or oversized token without asking", async () => {
    const fetchImpl = answer(200, { success: true });

    for (const token of [null, "", "   ", "x".repeat(2049)]) {
      await expect(checkTurnstile({ secret: "s", token, fetchImpl })).resolves.toBe("fail");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails a token Cloudflare rejects", async () => {
    for (const code of ["invalid-input-response", "timeout-or-duplicate", "bad-request"]) {
      const fetchImpl = answer(200, { success: false, "error-codes": [code] });
      await expect(checkTurnstile({ secret: "s", token: "tok", fetchImpl })).resolves.toBe("fail");
    }
  });

  it("lets the request through when Cloudflare cannot decide", async () => {
    const cases: (typeof fetch)[] = [
      vi.fn<typeof fetch>(async () => {
        throw new TypeError("fetch failed");
      }),
      answer(503, "upstream down"),
      answer(200, "<html>not json</html>"),
      answer(200, { success: false, "error-codes": ["internal-error"] }),
    ];

    for (const fetchImpl of cases) {
      await expect(checkTurnstile({ secret: "s", token: "tok", fetchImpl })).resolves.toBe(
        "unavailable",
      );
    }
  });

  it("lets the request through on a secret Cloudflare does not know, rather than refusing everyone", async () => {
    const fetchImpl = answer(200, { success: false, "error-codes": ["invalid-input-secret"] });

    await expect(checkTurnstile({ secret: "wrong", token: "tok", fetchImpl })).resolves.toBe(
      "unavailable",
    );
  });
});
