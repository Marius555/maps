import { beforeEach, describe, expect, it, vi } from "vitest";

import { liveSaysDisposable, resetLiveCache } from "./disposable-live";

/** Like `mx.test.ts`: what matters most is that not knowing is a pass. */
function answering(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

beforeEach(() => {
  resetLiveCache();
});

describe("liveSaysDisposable", () => {
  it("reads the string verdict the service sends", async () => {
    expect(await liveSaysDisposable("burner.example", answering({ disposable: "true" }))).toBe(true);
    expect(await liveSaysDisposable("shop.example", answering({ disposable: "false" }))).toBe(false);
  });

  it("sends a placeholder at the domain, never the address somebody typed", async () => {
    const fetcher = answering({ disposable: "false" });

    await liveSaysDisposable("shop.example", fetcher);

    const url = String((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]);
    expect(url).toContain(encodeURIComponent("check@shop.example"));
  });

  it("passes on an error status, a bad body or a network failure", async () => {
    expect(await liveSaysDisposable("a.example", answering({}, 503))).toBe(false);
    expect(await liveSaysDisposable("b.example", answering({ what: 1 }))).toBe(false);

    const failing = vi.fn(async () => {
      throw new Error("timeout");
    }) as unknown as typeof fetch;
    expect(await liveSaysDisposable("c.example", failing)).toBe(false);
  });

  it("caches a verdict but never an undecided answer", async () => {
    const down = answering({}, 503);
    await liveSaysDisposable("d.example", down);
    await liveSaysDisposable("d.example", down);
    expect(down).toHaveBeenCalledTimes(2);

    const up = answering({ disposable: "true" });
    await liveSaysDisposable("e.example", up);
    expect(await liveSaysDisposable("E.example ", up)).toBe(true);
    expect(up).toHaveBeenCalledTimes(1);
  });
});
