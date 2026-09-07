// @vitest-environment jsdom

/**
 * The two ways the embed asks the browser where the visitor is.
 *
 * Here rather than in the browser — which is where CLAUDE.md sends every other
 * question about this bundle — because what these hold is *timing*, and timing
 * is the one thing a real browser cannot be made to reproduce on demand. The
 * failure this file exists to catch looks like a correct route that starts on
 * the wrong street: a reading that arrived, was worse than the one after it, and
 * was used anyway. Nothing on screen says so.
 *
 * jsdom implements no Geolocation API at all, which is convenient: the stub
 * below is the whole of what the code under test can see.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bestPosition,
  betterFix,
  currentPosition,
  locationFailure,
} from "./search";

type Watcher = {
  success: PositionCallback;
  error: PositionErrorCallback | null | undefined;
  options: PositionOptions | undefined;
};

function position(accuracy: number, lat = 54.7, lng = 25.3): GeolocationPosition {
  return {
    coords: { latitude: lat, longitude: lng, accuracy },
    timestamp: 0,
  } as GeolocationPosition;
}

/** Carries the codes as own properties, because the code reads them off the error. */
function failure(code: number, message = "no"): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

const DENIED = 1;
const UNAVAILABLE = 2;

function stubGeolocation() {
  const watchers = new Map<number, Watcher>();
  const cleared: number[] = [];
  let next = 1;

  const single = vi.fn<Geolocation["getCurrentPosition"]>();

  const geo = {
    getCurrentPosition: single,
    watchPosition: vi.fn((success, error, options) => {
      const id = next;
      next += 1;
      watchers.set(id, { success, error, options });
      return id;
    }) as unknown as Geolocation["watchPosition"],
    clearWatch: vi.fn((id: number) => {
      cleared.push(id);
      watchers.delete(id);
    }),
  };

  Object.defineProperty(navigator, "geolocation", {
    value: geo,
    configurable: true,
  });

  return {
    geo,
    single,
    cleared,
    /** Every live watcher gets it — there is only ever one. */
    emit: (at: GeolocationPosition) => {
      for (const watcher of watchers.values()) watcher.success(at);
    },
    fail: (error: GeolocationPositionError) => {
      for (const watcher of watchers.values()) watcher.error?.(error);
    },
    optionsOf: (id = 1) => watchers.get(id)?.options,
  };
}

describe("bestPosition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, "geolocation");
  });

  it("waits out the window and answers with the sharpest reading, not the first", async () => {
    const geo = stubGeolocation();
    const settled = bestPosition(3000, 10);

    geo.emit(position(400, 54.1, 25.1));
    await vi.advanceTimersByTimeAsync(900);
    geo.emit(position(35, 54.9, 25.9));
    await vi.advanceTimersByTimeAsync(600);
    // Worse than what we already have: it must not win by being last.
    geo.emit(position(180, 54.5, 25.5));

    await vi.advanceTimersByTimeAsync(3000);

    await expect(settled).resolves.toEqual({
      lat: 54.9,
      lng: 25.9,
      accuracy: 35,
      timestamp: 0,
    });
    expect(geo.cleared).toEqual([1]);
  });

  it("stops early once a reading is good enough to use as-is", async () => {
    const geo = stubGeolocation();
    const settled = bestPosition(3000, 50);

    geo.emit(position(400));
    await vi.advanceTimersByTimeAsync(200);
    geo.emit(position(12));

    // Nothing has been advanced to the end of the window: the answer is already
    // here, and the caller is watching a blank tab.
    await vi.advanceTimersByTimeAsync(0);

    await expect(settled).resolves.toMatchObject({ accuracy: 12 });
    expect(geo.cleared).toEqual([1]);
  });

  it("asks for a fresh high-accuracy fix", async () => {
    const geo = stubGeolocation();
    const settled = bestPosition(3000, 50);

    expect(geo.optionsOf()).toMatchObject({
      enableHighAccuracy: true,
      maximumAge: 0,
    });

    geo.emit(position(5));
    await expect(settled).resolves.toMatchObject({ accuracy: 5 });
  });

  it("keeps a reading that a later failure follows", async () => {
    const geo = stubGeolocation();
    const settled = bestPosition(3000, 10);

    geo.emit(position(120));
    await vi.advanceTimersByTimeAsync(500);
    // One reading failed. It does not undo the one before it, and a route from
    // 120m is still a route.
    geo.fail(failure(UNAVAILABLE));

    await vi.advanceTimersByTimeAsync(3000);

    await expect(settled).resolves.toMatchObject({ accuracy: 120 });
  });

  it("gives up immediately when the visitor refuses", async () => {
    const geo = stubGeolocation();
    const settled = bestPosition(3000, 50);
    const caught = settled.catch((error: unknown) => locationFailure(error));

    geo.fail(failure(DENIED));
    // Not advanced: three seconds of a blank tab after a refusal is three
    // seconds of looking broken.
    await vi.advanceTimersByTimeAsync(0);

    await expect(caught).resolves.toBe("denied");
    expect(geo.cleared).toEqual([1]);
  });

  it("reports the failure it saw when the window closes with nothing", async () => {
    const geo = stubGeolocation();
    const caught = bestPosition(3000, 50).catch((error: unknown) =>
      locationFailure(error),
    );

    geo.fail(failure(UNAVAILABLE));
    await vi.advanceTimersByTimeAsync(3000);

    await expect(caught).resolves.toBe("unavailable");
    expect(geo.cleared).toEqual([1]);
  });

  it("times out when the browser says nothing at all", async () => {
    const geo = stubGeolocation();
    const caught = bestPosition(3000, 50).catch((error: unknown) =>
      locationFailure(error),
    );

    await vi.advanceTimersByTimeAsync(3000);

    await expect(caught).resolves.toBe("timeout");
    expect(geo.cleared).toEqual([1]);
  });

  it("rejects where the browser has no geolocation at all", async () => {
    const caught = bestPosition(3000, 50).catch((error: unknown) =>
      locationFailure(error),
    );

    await expect(caught).resolves.toBe("unsupported");
  });
});

describe("currentPosition", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "geolocation");
  });

  it("stays the cheap one — a cached, low-accuracy reading is fine for distances", async () => {
    const geo = stubGeolocation();
    const settled = currentPosition();

    const [success, , options] = geo.single.mock.calls[0] ?? [];
    expect(options).toMatchObject({
      enableHighAccuracy: false,
      maximumAge: 300_000,
    });

    success?.(position(900, 54.2, 25.2));

    await expect(settled).resolves.toEqual({
      lat: 54.2,
      lng: 25.2,
      accuracy: 900,
      timestamp: 0,
    });
  });
});

/**
 * The rule `me` in index.ts is kept by, and the one that decides what a
 * Directions link starts from.
 *
 * Worth testing where nothing tested it before: every one of these failures
 * renders as a perfectly ordinary Google Maps page whose start point is simply
 * somewhere else.
 */
describe("betterFix", () => {
  const now = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fix = (accuracy: number, ageMs: number) => ({
    lat: 54.7,
    lng: 25.3,
    accuracy,
    timestamp: now - ageMs,
  });

  it("takes anything over knowing nothing", () => {
    const first = fix(5000, 0);

    expect(betterFix(null, first)).toBe(first);
  });

  it("keeps the sharper of two fresh readings", () => {
    const coarse = fix(900, 0);
    const sharp = fix(20, 0);

    expect(betterFix(coarse, sharp)).toBe(sharp);
    expect(betterFix(sharp, coarse)).toBe(sharp);
  });

  /*
   * The bug this function was extracted for. The crosshair accepts a cached fix
   * up to five minutes old, so a sharp-sounding reading of somewhere the visitor
   * has since left could hold `me` for the whole session.
   */
  it("prefers a fresh coarse reading over a sharp stale one", () => {
    const staleAndSharp = fix(10, 5 * 60_000);
    const freshAndCoarse = fix(900, 0);

    expect(betterFix(staleAndSharp, freshAndCoarse)).toBe(freshAndCoarse);
  });

  it("does not let a stale reading displace a fresh one, however sharp", () => {
    const fresh = fix(900, 0);
    const stale = fix(10, 5 * 60_000);

    expect(betterFix(fresh, stale)).toBe(fresh);
  });

  it("falls back to accuracy when both are stale, having nothing better", () => {
    const old = fix(900, 10 * 60_000);
    const olderButSharper = fix(30, 20 * 60_000);

    expect(betterFix(old, olderButSharper)).toBe(olderButSharper);
  });

  it("gives a tie to the newcomer, so somebody who moved is followed", () => {
    const there = fix(50, 0);
    const here = { ...fix(50, 0), lat: 55.1 };

    expect(betterFix(there, here)).toBe(here);
  });
});
