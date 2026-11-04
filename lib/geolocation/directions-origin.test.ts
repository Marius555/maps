// @vitest-environment jsdom

/**
 * When the dashboard's card learns where the person pressing Directions is, and
 * when it asks again.
 *
 * The state lives at module level, so every test imports a fresh copy after
 * `vi.resetModules()`. jsdom implements neither Geolocation nor the Permissions
 * API, so the stubs below are the whole of what the code under test can see —
 * the `watchPosition` half of the one in embed/src/directions.test.ts, copied
 * rather than shared for that file's reason.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Store = typeof import("./directions-origin");

type Watcher = {
  success: PositionCallback;
  error: PositionErrorCallback | null | undefined;
};

const DENIED = 1;
const UNAVAILABLE = 2;

function failure(code: number): GeolocationPositionError {
  return {
    code,
    message: "no",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

function position(accuracy: number, lat = 54.7): GeolocationPosition {
  return {
    coords: { latitude: lat, longitude: 25.3, accuracy },
    timestamp: Date.now(),
  } as GeolocationPosition;
}

function stubGeolocation() {
  const watchers = new Map<number, Watcher>();
  let next = 1;

  const watchPosition = vi.fn((success: PositionCallback, error?: PositionErrorCallback | null) => {
    const id = next;
    next += 1;
    watchers.set(id, { success, error });
    return id;
  });

  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: vi.fn(),
      watchPosition,
      clearWatch: vi.fn((id: number) => watchers.delete(id)),
    },
    configurable: true,
  });

  return {
    watchPosition,
    emit: (at: GeolocationPosition) => {
      for (const watcher of [...watchers.values()]) watcher.success(at);
    },
    fail: (error: GeolocationPositionError) => {
      for (const watcher of [...watchers.values()]) watcher.error?.(error);
    },
  };
}

function stubPermission(state: PermissionState) {
  const listeners: (() => void)[] = [];
  const permission = {
    state,
    addEventListener: (_: string, listener: () => void) => listeners.push(listener),
  };

  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn(() => Promise.resolve(permission)) },
    configurable: true,
  });

  return {
    change(to: PermissionState) {
      permission.state = to;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

async function freshStore(): Promise<Store> {
  vi.resetModules();
  return import("./directions-origin");
}

/** Lets the promise chains inside the store run. */
async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "geolocation");
  Reflect.deleteProperty(navigator, "permissions");
});

describe("askForOrigin", () => {
  it("asks once for any number of presses while a lookup is running", async () => {
    const geo = stubGeolocation();
    const store = await freshStore();

    store.askForOrigin();
    store.askForOrigin();

    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });

  it("publishes the first reading to subscribers, so an open card re-renders", async () => {
    const geo = stubGeolocation();
    const store = await freshStore();
    const listener = vi.fn();
    store.subscribeOrigin(listener);

    store.askForOrigin();
    geo.emit(position(400));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getOrigin()).toMatchObject({ lat: 54.7, lng: 25.3, accuracy: 400 });
  });

  it("never asks again after the browser refuses", async () => {
    const geo = stubGeolocation();
    const store = await freshStore();

    store.askForOrigin();
    geo.fail(failure(DENIED));
    await settle();

    store.askForOrigin();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });

  it("asks again after a window that produced nothing — silence is not a refusal", async () => {
    const geo = stubGeolocation();
    const store = await freshStore();

    store.askForOrigin();
    geo.fail(failure(UNAVAILABLE));
    await vi.advanceTimersByTimeAsync(30_000);

    store.askForOrigin();
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);
  });

  it("does not ask once a position is known", async () => {
    const geo = stubGeolocation();
    const store = await freshStore();

    store.askForOrigin();
    geo.emit(position(10));
    await settle();

    store.askForOrigin();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });
});

describe("the sharpest recent reading wins", () => {
  it("replaces the origin with a sharper reading and notifies", async () => {
    const geo = stubGeolocation();
    const store = await freshStore();
    const listener = vi.fn();
    store.subscribeOrigin(listener);

    store.askForOrigin();
    geo.emit(position(400, 54.7));
    geo.emit(position(30, 54.71));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getOrigin()).toMatchObject({ lat: 54.71, accuracy: 30 });
  });

  it("keeps the origin and stays quiet when a vaguer reading arrives", async () => {
    const geo = stubGeolocation();
    const store = await freshStore();
    const listener = vi.fn();
    store.subscribeOrigin(listener);

    store.askForOrigin();
    geo.emit(position(30, 54.71));
    geo.emit(position(400, 54.7));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getOrigin()).toMatchObject({ lat: 54.71, accuracy: 30 });
  });
});

describe("warmOrigin", () => {
  it("locates without a press when the permission is already granted", async () => {
    const geo = stubGeolocation();
    stubPermission("granted");
    const store = await freshStore();

    store.warmOrigin();
    await settle();

    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });

  it("raises nothing while the permission is still a question", async () => {
    const geo = stubGeolocation();
    stubPermission("prompt");
    const store = await freshStore();

    store.warmOrigin();
    await settle();

    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  it("runs once per page however many cards mount", async () => {
    stubGeolocation();
    stubPermission("prompt");
    const store = await freshStore();

    store.warmOrigin();
    store.warmOrigin();
    await settle();

    expect(navigator.permissions.query).toHaveBeenCalledTimes(1);
  });

  it("picks up a grant given later — the answer to the first press's prompt", async () => {
    const geo = stubGeolocation();
    const permission = stubPermission("prompt");
    const store = await freshStore();

    store.warmOrigin();
    await settle();
    permission.change("granted");

    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });

  it("does not ask on a press where the permission reads denied (the Shopify admin frame)", async () => {
    const geo = stubGeolocation();
    stubPermission("denied");
    const store = await freshStore();

    store.warmOrigin();
    await settle();
    store.askForOrigin();

    expect(geo.watchPosition).not.toHaveBeenCalled();
  });
});
