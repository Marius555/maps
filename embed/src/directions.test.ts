// @vitest-environment jsdom

/**
 * What URL a visitor actually gets, given what we know about where they are.
 *
 * The question is asked of `directionsLink` rather than of a predicate, because
 * both bugs this file guards were about the link and not about a rule. The
 * first: an accuracy gate that dropped anything coarser than 50m, which on a
 * machine with no GPS is every reading, so a desktop visitor was sent to Google
 * with **no origin at all** and Google fell back to their IP address — a route
 * starting in another town, where before it had merely started on the wrong
 * street. The second, the mirror of it: a coarse fix reaching the link from a
 * code path that had no gate, back when the gate lived in one branch instead of
 * here.
 *
 * So the rule now has one clause, and these hold it: **whatever the browser
 * says is what we send, and the only thing we decline to send is nothing.**
 *
 * The two blocks after it hold the other half, which is *when* a link is allowed
 * to learn. Both were bugs that shipped and that no test could have caught,
 * because there was no test: a link built before the browser answered kept its
 * origin-less href forever, and an ask that produced nothing latched a flag that
 * stopped anybody ever asking again.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  directionsLink,
  installDirectionsAsk,
  refreshDirections,
} from "./directions";
import type { Fix } from "./search";

const PLACE = { name: "Shop", lat: 55.7, lng: 21.13 };

/**
 * The age is nobody's question here — what a link does with a reading is
 * decided by `directionsUrl`, and `betterFix` has already chosen which reading
 * that is — so these are all written as fresh.
 */
function fix(at: Partial<Omit<Fix, "timestamp">> = {}): Fix {
  return {
    lat: 54.7,
    lng: 25.3,
    accuracy: 40,
    ...at,
    timestamp: Date.now(),
  };
}

function hrefFor(at: Omit<Fix, "timestamp"> | null) {
  const node = directionsLink(
    "x",
    "Directions",
    PLACE,
    at && { ...at, timestamp: Date.now() },
  );

  return node instanceof HTMLAnchorElement ? node.getAttribute("href") : null;
}

describe("directionsLink", () => {
  it("sends a GPS-grade fix", () => {
    const href = hrefFor({ lat: 54.7, lng: 25.3, accuracy: 12 });

    expect(href).toContain("destination=55.7,21.13");
    expect(href).toContain("origin=54.7,25.3");
  });

  /*
   * The regression. Dropping this fix is what turned "a street off" into
   * "another town": with no origin Google guesses, and it guesses from an IP
   * address unless it has been given a location of its own.
   */
  it("sends a coarse fix too, because the alternative is Google's IP guess", () => {
    expect(hrefFor({ lat: 54.7, lng: 25.3, accuracy: 800 })).toContain(
      "origin=54.7,25.3",
    );
  });

  it("sends a fix vague enough to be a whole city", () => {
    expect(hrefFor({ lat: 54.7, lng: 25.3, accuracy: 12_000 })).toContain(
      "origin=54.7,25.3",
    );
  });

  it("sends no origin when nothing knows where the visitor is", () => {
    const href = hrefFor(null);

    expect(href).toContain("destination=55.7,21.13");
    expect(href).not.toContain("origin=");
  });

  it("marks the anchor so the delegated warm-up can recognise it", () => {
    expect(directionsLink("x", "Directions", PLACE, null).dataset.lmDir).toBe(
      "1",
    );
  });
});

/**
 * The reported bug, in one describe.
 *
 * The results panel is drawn once, synchronously, at boot — before any of the
 * four things that learn a position can possibly have answered — and it is
 * redrawn only by a keystroke, a filter or the crosshair. So every row a visitor
 * sees was built with nothing known, and reading the position "per row" bought
 * exactly nothing. A visitor could press the map's own locate control, watch it
 * draw a circle around their street, press Directions and still be routed from
 * their ISP's address.
 */
describe("refreshDirections", () => {
  const rootWith = (...nodes: HTMLElement[]) => {
    const root = document.createElement("div");
    root.append(...nodes);

    return root;
  };

  it("re-points a link that was drawn before anything knew where the visitor was", () => {
    const root = rootWith(directionsLink("x", "Directions", PLACE, null));
    const anchor = root.querySelector("a");

    expect(anchor?.getAttribute("href")).not.toContain("origin=");

    refreshDirections(root, fix({ lat: 54.7, lng: 25.3 }));

    expect(anchor?.getAttribute("href")).toContain("origin=54.7,25.3");
    expect(anchor?.getAttribute("href")).toContain("destination=55.7,21.13");
  });

  /*
   * The naive implementation appends. A second, sharper reading has to replace
   * the first origin — two of them is a URL Google reads as neither.
   */
  it("replaces an origin rather than accumulating them", () => {
    const root = rootWith(
      directionsLink("x", "Directions", PLACE, fix({ accuracy: 900 })),
    );

    refreshDirections(root, fix({ lat: 54.8, lng: 25.4, accuracy: 12 }));

    const href = root.querySelector("a")?.getAttribute("href") ?? "";

    expect(href.match(/origin=/g)).toHaveLength(1);
    expect(href).toContain("origin=54.8,25.4");
  });

  it("reaches every link under the root, not just the first", () => {
    const root = rootWith(
      directionsLink("x", "Directions", PLACE, null),
      directionsLink("x", "Directions", { ...PLACE, lat: 10, lng: 20 }, null),
      directionsLink("x", "Directions", { ...PLACE, lat: 30, lng: 40 }, null),
    );

    refreshDirections(root, fix({ lat: 1, lng: 2 }));

    const hrefs = [...root.querySelectorAll("a")].map((node) =>
      node.getAttribute("href"),
    );

    expect(hrefs.every((href) => href?.includes("origin=1,2"))).toBe(true);
    expect(hrefs[1]).toContain("destination=10,20");
    expect(hrefs[2]).toContain("destination=30,40");
  });

  /*
   * The marker is an attribute on a page we do not own. A host page's own
   * markup, or a node cloned out from under us, wears it without us ever having
   * built it — and rewriting a stranger's href would be a worse bug than the one
   * this function fixes.
   */
  it("leaves an anchor it did not build alone", () => {
    const stray = document.createElement("a");
    stray.dataset.lmDir = "1";
    stray.href = "https://example.com/";

    const root = rootWith(stray);

    expect(() => {
      refreshDirections(root, fix());
    }).not.toThrow();
    expect(stray.getAttribute("href")).toBe("https://example.com/");
  });

  it("orders the pair latitude first, which is what both apps read", () => {
    // The one mistake that produces a plausible wrong answer rather than an
    // error: a swapped pair is a real place, just not this one.
    const root = rootWith(directionsLink("x", "Directions", PLACE, null));

    refreshDirections(root, fix({ lat: 1, lng: 2 }));

    expect(root.querySelector("a")?.getAttribute("href")).toContain(
      "origin=1,2",
    );
  });
});

/**
 * When the embed is allowed to ask, and — the bug — when it is allowed to ask
 * again.
 *
 * jsdom implements no Geolocation API, so the stub below is the whole of what
 * the code under test can see. It is the `watchPosition` half of the one in
 * ./search.test.ts, copied rather than extracted: test files are never bundled,
 * so the duplication costs no bytes, and the alternative is a shared helper
 * module that the embed's own import rules would then have to have an opinion
 * about.
 */
describe("installDirectionsAsk", () => {
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

  function position(accuracy = 400): GeolocationPosition {
    return {
      coords: { latitude: 54.7, longitude: 25.3, accuracy },
      timestamp: 0,
    } as GeolocationPosition;
  }

  function stubGeolocation() {
    const watchers = new Map<number, Watcher>();
    const cleared: number[] = [];
    let next = 1;

    const watchPosition = vi.fn((success, error) => {
      const id = next;
      next += 1;
      watchers.set(id, { success, error });
      return id;
    }) as unknown as Geolocation["watchPosition"];

    const clearWatch = vi.fn((id: number) => {
      cleared.push(id);
      watchers.delete(id);
    });

    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: vi.fn(), watchPosition, clearWatch },
      configurable: true,
    });

    return {
      watchPosition: watchPosition as unknown as ReturnType<typeof vi.fn>,
      cleared,
      emit: (at: GeolocationPosition) => {
        for (const watcher of watchers.values()) watcher.success(at);
      },
      fail: (error: GeolocationPositionError) => {
        for (const watcher of watchers.values()) watcher.error?.(error);
      },
    };
  }

  /** A root carrying one Directions link, which is what the listener matches. */
  function rootWithLink() {
    const root = document.createElement("div");
    root.append(directionsLink("x", "Directions", PLACE, null));

    return root;
  }

  const anchorOf = (root: HTMLElement) =>
    root.querySelector("a") as HTMLAnchorElement;

  const pointerDown = (root: HTMLElement) => {
    anchorOf(root).dispatchEvent(new Event("pointerdown", { bubbles: true }));
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, "geolocation");
  });

  /*
   * The bug. `asked` was set before the lookup and never cleared, so a window
   * that closed having produced nothing — which is exactly what happens when the
   * settle timer fires in a tab the visitor left for Google Maps — permanently
   * prevented a second ask. One chance, spent on a prompt nobody saw.
   */
  it("asks again after a window that produced nothing", async () => {
    const geo = stubGeolocation();
    const root = rootWithLink();
    installDirectionsAsk(root, () => null, vi.fn(), vi.fn());

    pointerDown(root);
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(31_000);
    pointerDown(root);

    expect(geo.watchPosition).toHaveBeenCalledTimes(2);
  });

  it("never asks again once the visitor has refused", async () => {
    const geo = stubGeolocation();
    const root = rootWithLink();
    installDirectionsAsk(root, () => null, vi.fn(), vi.fn());

    pointerDown(root);
    geo.fail(failure(DENIED));
    await vi.advanceTimersByTimeAsync(0);

    pointerDown(root);

    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });

  /*
   * An unavailable fix is not a decision — it is one failed reading. Latching on
   * it would silence the feature for the session over a momentary radio state.
   */
  it("asks again after a fix that was merely unavailable", async () => {
    const geo = stubGeolocation();
    const root = rootWithLink();
    installDirectionsAsk(root, () => null, vi.fn(), vi.fn());

    pointerDown(root);
    geo.fail(failure(UNAVAILABLE));
    await vi.advanceTimersByTimeAsync(31_000);

    pointerDown(root);

    expect(geo.watchPosition).toHaveBeenCalledTimes(2);
  });

  it("does not start a second lookup while one is in flight", () => {
    const geo = stubGeolocation();
    const root = rootWithLink();
    installDirectionsAsk(root, () => null, vi.fn(), vi.fn());

    pointerDown(root);
    pointerDown(root);

    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });

  it("does not ask at all when something already knows", () => {
    const geo = stubGeolocation();
    const root = rootWithLink();
    installDirectionsAsk(root, () => fix(), vi.fn(), vi.fn());

    pointerDown(root);

    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  /*
   * The three-second settle is what withdrew the prompt: it fires in the
   * backgrounded tab, `bestPosition` clears its watch, and clearing the only
   * outstanding geolocation request takes the permission bubble off screen. The
   * visitor comes back from Google Maps to nothing left to answer.
   */
  it("outlives bestPosition's own three-second settle", async () => {
    const geo = stubGeolocation();
    const root = rootWithLink();
    installDirectionsAsk(root, () => null, vi.fn(), vi.fn());

    pointerDown(root);

    await vi.advanceTimersByTimeAsync(3_100);
    expect(geo.cleared).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(geo.cleared).toHaveLength(1);
  });

  it("asks on a keyboard activation, which fires click and no pointer event", () => {
    const geo = stubGeolocation();
    const root = rootWithLink();
    installDirectionsAsk(root, () => null, vi.fn(), vi.fn());

    anchorOf(root).dispatchEvent(new Event("click", { bubbles: true }));

    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });

  it("asks once for one press, not twice for pointerdown and then click", () => {
    const geo = stubGeolocation();
    const root = rootWithLink();
    installDirectionsAsk(root, () => null, vi.fn(), vi.fn());

    pointerDown(root);
    anchorOf(root).dispatchEvent(new Event("click", { bubbles: true }));

    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });

  it("ignores a press that is not on a Directions link", () => {
    const geo = stubGeolocation();
    const root = rootWithLink();
    const other = document.createElement("a");
    other.href = "https://example.com/";
    root.append(other);
    installDirectionsAsk(root, () => null, vi.fn(), vi.fn());

    other.dispatchEvent(new Event("pointerdown", { bubbles: true }));

    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  /*
   * The rule the whole file is shaped by. A handler that cancels the navigation
   * is how five seconds of blank tab got shipped once already.
   */
  it("never touches the navigation", () => {
    stubGeolocation();
    const root = rootWithLink();
    installDirectionsAsk(root, () => null, vi.fn(), vi.fn());

    const event = new Event("pointerdown", { bubbles: true, cancelable: true });
    anchorOf(root).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  /*
   * Reported per reading rather than once at the end, and this is what makes the
   * refresh worth having: the answer reaches `remember` — and through it every
   * link already on screen — while the window is still open.
   */
  it("reports every reading upward, not only the best at the end", () => {
    const geo = stubGeolocation();
    const root = rootWithLink();
    const onLocated = vi.fn();
    installDirectionsAsk(root, () => null, onLocated, vi.fn());

    pointerDown(root);
    geo.emit(position(400));

    expect(onLocated).toHaveBeenCalledTimes(1);
    expect(onLocated.mock.calls[0]?.[0]).toMatchObject({
      lat: 54.7,
      lng: 25.3,
      accuracy: 400,
    });
  });
});
