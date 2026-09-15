// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { retryImport } from "./retry-import";

const RELOADED_KEY = "lm-chunk-reloaded";

/** The shape Turbopack's runtime throws when a chunk will not fetch. */
function chunkLoadError(): Error {
  const error = new Error("Failed to load chunk /_next/static/chunks/x.css");
  error.name = "ChunkLoadError";
  return error;
}

let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  reload = vi.fn();
  // jsdom does not implement navigation, so the real `location.reload` throws.
  vi.stubGlobal("location", { reload });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/**
 * Runs the loader to settlement with the backoff timers driven by hand.
 *
 * `runAllTimersAsync` has to interleave with the awaits inside the retry loop,
 * so the promise is started first and the timers advanced alongside it.
 */
async function settle<T>(load: () => Promise<T>) {
  const result = retryImport(load)();
  const caught = result.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  return caught;
}

describe("retryImport", () => {
  it("passes a first-try success straight through", async () => {
    const load = vi.fn().mockResolvedValue({ default: "module" });

    const outcome = await settle(load);

    expect(outcome).toEqual({ ok: true, value: { default: "module" } });
    expect(load).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("retries a chunk failure and resolves on the next attempt", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(chunkLoadError())
      .mockResolvedValue({ default: "module" });

    const outcome = await settle(load);

    expect(outcome.ok).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it("clears the reload guard on success, so a later deploy gets its own reload", async () => {
    sessionStorage.setItem(RELOADED_KEY, "1");

    await settle(vi.fn().mockResolvedValue({ default: "module" }));

    expect(sessionStorage.getItem(RELOADED_KEY)).toBeNull();
  });

  /*
   * The property that keeps a real bug in the dynamically imported module from
   * turning into a three-second wait and a reload into the identical crash.
   */
  it("rethrows a non-chunk error immediately, without retrying or reloading", async () => {
    const boom = new Error("boom");
    const load = vi.fn().mockRejectedValue(boom);

    const outcome = await settle(load);

    expect(outcome).toEqual({ ok: false, error: boom });
    expect(load).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("exhausts its attempts, then reloads once and throws", async () => {
    const error = chunkLoadError();
    const load = vi.fn().mockRejectedValue(error);

    const outcome = await settle(load);

    expect(outcome).toEqual({ ok: false, error });
    expect(load).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOADED_KEY)).toBe("1");
  });

  it("does not reload a second time in the same tab", async () => {
    sessionStorage.setItem(RELOADED_KEY, "1");

    const outcome = await settle(vi.fn().mockRejectedValue(chunkLoadError()));

    expect(outcome.ok).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("fails closed when sessionStorage throws, rather than risking a reload loop", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    const outcome = await settle(vi.fn().mockRejectedValue(chunkLoadError()));

    expect(outcome.ok).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
