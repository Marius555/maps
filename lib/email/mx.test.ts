import { beforeEach, describe, expect, it, vi } from "vitest";

import { domainAcceptsMail, resetMxCache, type MailResolver } from "./mx";

/**
 * **The assertion that matters most here is that we say yes when we don't know.**
 *
 * This check sits in the path of a signup — the one request somebody makes
 * before they are a customer — so the failure that costs real money is not a
 * throwaway address getting through. It is a resolver hiccup turning into "you
 * cannot create an account", on a Sunday, silently, for everyone. Every
 * indecisive branch below is asserted to pass, and none of them should be
 * "tightened" without that sentence being argued with first.
 */

function dnsError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function resolver(overrides: Partial<MailResolver> = {}): MailResolver {
  return {
    resolveMx: vi.fn(async () => [{ exchange: "mx.example.com", priority: 10 }]),
    resolve4: vi.fn(async () => ["203.0.113.1"]),
    resolve6: vi.fn(async () => []),
    ...overrides,
  };
}

beforeEach(() => {
  resetMxCache();
});

describe("a decisive answer", () => {
  it("accepts a domain with an MX record", async () => {
    expect(await domainAcceptsMail("example.com", resolver())).toBe(true);
  });

  it("accepts a domain with no MX but an address record", async () => {
    // RFC 5321 §5.1 — the A record is the implicit mail exchange, and plenty of
    // small business domains have never had anything else.
    const dns = resolver({ resolveMx: vi.fn(async () => []) });

    expect(await domainAcceptsMail("example.com", dns)).toBe(true);
    expect(dns.resolve4).toHaveBeenCalledWith("example.com");
  });

  it("accepts a domain reachable only over IPv6", async () => {
    const dns = resolver({
      resolveMx: vi.fn(async () => {
        throw dnsError("ENODATA");
      }),
      resolve4: vi.fn(async () => {
        throw dnsError("ENODATA");
      }),
      resolve6: vi.fn(async () => ["2001:db8::1"]),
    });

    expect(await domainAcceptsMail("example.com", dns)).toBe(true);
  });

  it("refuses a domain that does not exist", async () => {
    const dns = resolver({
      resolveMx: vi.fn(async () => {
        throw dnsError("ENOTFOUND");
      }),
    });

    expect(await domainAcceptsMail("gmial.invalid", dns)).toBe(false);
    // Settled by the MX answer alone — no point asking for address records for
    // a name that has no records of any kind.
    expect(dns.resolve4).not.toHaveBeenCalled();
  });

  it("refuses a domain with records but nowhere to deliver", async () => {
    const dns = resolver({
      resolveMx: vi.fn(async () => {
        throw dnsError("ENODATA");
      }),
      resolve4: vi.fn(async () => {
        throw dnsError("ENODATA");
      }),
      resolve6: vi.fn(async () => {
        throw dnsError("ENODATA");
      }),
    });

    expect(await domainAcceptsMail("example.com", dns)).toBe(false);
  });

  it("refuses a null MX, which is a domain saying it takes no mail", async () => {
    // RFC 7505. An answer, not an absence — so it must not fall through to the
    // address records, which such a domain usually has.
    const dns = resolver({
      resolveMx: vi.fn(async () => [{ exchange: ".", priority: 0 }]),
    });

    expect(await domainAcceptsMail("example.com", dns)).toBe(false);
    expect(dns.resolve4).not.toHaveBeenCalled();
  });
});

describe("an uncertain answer is a yes", () => {
  it.each(["SERVFAIL", "ECONNREFUSED", "ETIMEOUT", "EAI_AGAIN"])(
    "passes the address through on %s",
    async (code) => {
      const dns = resolver({
        resolveMx: vi.fn(async () => {
          throw dnsError(code);
        }),
      });

      expect(await domainAcceptsMail("example.com", dns)).toBe(true);
    },
  );

  it("passes the address through when the resolver never answers", async () => {
    vi.useFakeTimers();

    const dns = resolver({
      resolveMx: vi.fn(
        () => new Promise<{ exchange: string; priority: number }[]>(() => {}),
      ),
    });
    const answer = domainAcceptsMail("example.com", dns);

    await vi.advanceTimersByTimeAsync(2_500);
    expect(await answer).toBe(true);

    vi.useRealTimers();
  });

  it("passes the address through when the resolver throws something odd", async () => {
    const dns = resolver({
      resolveMx: vi.fn(async () => {
        throw new Error("no code on this one");
      }),
    });

    expect(await domainAcceptsMail("example.com", dns)).toBe(true);
  });

  it("never caches an uncertain answer", async () => {
    // A single blip must not vouch for a domain for the next six hours.
    const resolveMx = vi.fn(async () => {
      throw dnsError("SERVFAIL");
    });

    await domainAcceptsMail("example.com", resolver({ resolveMx }));
    await domainAcceptsMail("example.com", resolver({ resolveMx }));

    expect(resolveMx).toHaveBeenCalledTimes(2);
  });
});

describe("the cache", () => {
  it("answers a repeated domain without asking again", async () => {
    const dns = resolver();

    expect(await domainAcceptsMail("example.com", dns)).toBe(true);
    expect(await domainAcceptsMail("EXAMPLE.com ", dns)).toBe(true);

    expect(dns.resolveMx).toHaveBeenCalledTimes(1);
  });

  it("keeps one domain's answer out of another's", async () => {
    const dns = resolver();
    const missing = resolver({
      resolveMx: vi.fn(async () => {
        throw dnsError("ENOTFOUND");
      }),
    });

    expect(await domainAcceptsMail("example.com", dns)).toBe(true);
    expect(await domainAcceptsMail("nope.invalid", missing)).toBe(false);
  });

  it("refuses an empty domain without asking anyone", async () => {
    const dns = resolver();

    expect(await domainAcceptsMail("", dns)).toBe(false);
    expect(dns.resolveMx).not.toHaveBeenCalled();
  });
});
