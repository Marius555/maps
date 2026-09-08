// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MapSnapshot } from "@/packages/shared/snapshot";
import { createTracker, trackLinks } from "./track";

/**
 * The one thing in the embed that talks to a server of ours at runtime.
 *
 * What is worth testing here is not that an event is recorded — it is the two
 * properties CLAUDE.md §2 is leaning on: that a map without the field sends
 * **nothing at all**, and that a session with forty interactions is **one**
 * request rather than forty. If either of those stops being true the cost
 * argument for the whole feature stops being true with it.
 */

const ENDPOINT = "https://dash.example.com/api/collect";

function snapshot(analytics?: { url: string }): MapSnapshot {
  return {
    version: 1,
    generatedAt: "2026-09-07T00:00:00.000Z",
    mapId: "map123",
    name: "Shops",
    slug: "shops",
    styleUrl: "https://tiles.example.com/style.json",
    attribution: "",
    center: { lat: 0, lng: 0, zoom: 2 },
    bounds: null,
    places: [],
    settings: { clustering: true, search: true, nearest: true },
    allowedDomains: [],
    ...(analytics ? { analytics } : {}),
  };
}

let sent: { url: string; body: string }[] = [];

beforeEach(() => {
  sent = [];
  vi.useFakeTimers();

  // Read back as text so the assertions can look at what was actually posted.
  navigator.sendBeacon = vi.fn((url: string | URL, data?: BodyInit | null) => {
    sent.push({ url: String(url), body: String(data) });
    return true;
  }) as unknown as typeof navigator.sendBeacon;
});

afterEach(() => {
  /*
   * Drain every tracker this file has created, not only the one under test.
   *
   * `createTracker` subscribes for the life of the page and never unsubscribes —
   * correct in the embed, where the page ending is the only thing that stops it,
   * and awkward here, where one jsdom window is shared by every case. A tracker
   * left holding events would flush into the *next* test's mock and be counted
   * there. Draining first empties every queue, so a leaked subscriber can only
   * ever be a no-op afterwards.
   */
  window.dispatchEvent(new Event("pagehide"));

  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });

  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Blobs do not stringify usefully in jsdom, so the payload is read back. */
async function bodies(): Promise<Record<string, unknown>[]> {
  const calls = (navigator.sendBeacon as unknown as ReturnType<typeof vi.fn>).mock
    .calls as [string, Blob][];

  return Promise.all(
    calls.map(async ([, blob]) => JSON.parse(await blob.text()) as Record<string, unknown>),
  );
}

function hide(): void {
  Object.defineProperty(document, "visibilityState", {
    value: "hidden",
    configurable: true,
  });
  // Bubbling, because that is how a browser fires it.
  document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
}

describe("createTracker", () => {
  it("sends nothing at all when the snapshot has no analytics field", () => {
    // Absent is the contract, and it is what every map published before this
    // shipped carries forever.
    const track = createTracker(snapshot());

    track("view");
    track("open", { id: "a" });
    hide();

    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  it("sends nothing until the page goes away", () => {
    const track = createTracker(snapshot({ url: ENDPOINT }));

    track("view");
    track("open", { id: "a" });

    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  it("sends one request for a whole session", async () => {
    // The property the cost argument rests on: forty interactions, one write.
    const track = createTracker(snapshot({ url: ENDPOINT }));

    track("view");
    for (let i = 0; i < 20; i += 1) track("open", { id: `place-${String(i)}` });
    track("directions", { id: "place-3" });

    hide();

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);

    const [payload] = await bodies();
    expect(payload.m).toBe("map123");
    expect(payload.e).toHaveLength(22);
  });

  it("posts to the URL the snapshot named", () => {
    const track = createTracker(snapshot({ url: ENDPOINT }));

    track("view");
    hide();

    expect(sent[0].url).toBe(ENDPOINT);
  });

  it("posts text/plain, so the browser sends no preflight", async () => {
    const track = createTracker(snapshot({ url: ENDPOINT }));

    track("view");
    hide();

    const [, blob] = (navigator.sendBeacon as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [string, Blob];

    // application/json would double the request count per session.
    expect(blob.type).toBe("text/plain");
  });

  it("flushes on pagehide as well as on a hidden tab", () => {
    const track = createTracker(snapshot({ url: ENDPOINT }));

    track("view");
    window.dispatchEvent(new Event("pagehide"));

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("flushes a session that never gets hidden", () => {
    // A map left open in a foreground tab would otherwise be lost to a crash.
    const track = createTracker(snapshot({ url: ENDPOINT }));

    track("view");
    vi.advanceTimersByTime(31_000);

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("does not send an empty session", () => {
    createTracker(snapshot({ url: ENDPOINT }));

    hide();
    window.dispatchEvent(new Event("pagehide"));

    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  it("sends nothing twice", () => {
    const track = createTracker(snapshot({ url: ENDPOINT }));

    track("view");
    hide();
    window.dispatchEvent(new Event("pagehide"));

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("stops queueing at the cap, and flushes when it reaches it", async () => {
    const track = createTracker(snapshot({ url: ENDPOINT }));

    for (let i = 0; i < 200; i += 1) track("pin", { id: String(i) });

    const [payload] = await bodies();
    expect(payload.e).toHaveLength(60);
  });

  it("truncates a long value rather than dropping the event", async () => {
    const track = createTracker(snapshot({ url: ENDPOINT }));

    track("search", { q: "x".repeat(500), n: 0 });
    hide();

    const [payload] = await bodies();
    const events = payload.e as { q: string; n: number }[];

    expect(events[0].q).toHaveLength(80);
    expect(events[0].n).toBe(0);
  });

  it("carries the page it is embedded on and where the visitor came from", async () => {
    const track = createTracker(snapshot({ url: ENDPOINT }));

    track("view");
    hide();

    const [payload] = await bodies();

    // Three different questions: which site, which page of it, and where the
    // visitor was before it.
    expect(payload).toHaveProperty("h", window.location.hostname);
    expect(payload).toHaveProperty("p", window.location.pathname);
    expect(payload).toHaveProperty("r");
  });

  it("carries no client timestamp", async () => {
    // The server dates a session from its own clock — a browser's can be years
    // out, and every figure on the dashboard is bucketed by that date.
    const track = createTracker(snapshot({ url: ENDPOINT }));

    track("view");
    hide();

    const [payload] = await bodies();
    expect(payload).not.toHaveProperty("t");
  });
});

describe("trackLinks", () => {
  function rootWith(html: string): HTMLElement {
    const root = document.createElement("div");
    root.innerHTML = html;
    document.body.append(root);

    return root;
  }

  it("classifies a press by its scheme, and names the location", () => {
    const track = vi.fn();
    const root = rootWith(
      `<div data-lm-place="place-9">
         <a class="lm-popup__link" href="tel:+37060000000">Call</a>
         <a class="lm-popup__link" href="mailto:a@b.com">Email</a>
         <a class="lm-popup__link" href="https://shop.example.com">Site</a>
       </div>`,
    );
    trackLinks(root, track);

    for (const anchor of root.querySelectorAll("a")) anchor.click();

    expect(track.mock.calls.map(([type]) => type)).toEqual(["tel", "email", "site"]);
    expect(track.mock.calls.every(([, data]) => data.id === "place-9")).toBe(true);
  });

  it("leaves Directions to the listener that already reports it", () => {
    const track = vi.fn();
    const root = rootWith(
      `<a class="lm-popup__link" data-lm-dir="place-1" href="https://maps.example">Go</a>`,
    );
    trackLinks(root, track);

    root.querySelector("a")?.click();

    expect(track).not.toHaveBeenCalled();
  });

  it("ignores MapLibre's own attribution links", () => {
    const track = vi.fn();
    const root = rootWith(
      `<a class="maplibregl-ctrl-attrib-inner" href="https://osm.org">OSM</a>`,
    );
    trackLinks(root, track);

    root.querySelector("a")?.click();

    expect(track).not.toHaveBeenCalled();
  });

  it("sees a gallery step even though it stops propagation", () => {
    // The reason this listener is registered in the capture phase.
    const track = vi.fn();
    const root = rootWith(
      `<div data-lm-place="p1"><button class="lm-popup__step">Next</button></div>`,
    );
    const step = root.querySelector("button");
    step?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    trackLinks(root, track);
    step?.click();

    expect(track).toHaveBeenCalledWith("gallery", { id: "p1" });
  });

  it("counts a fold opening and not its closing", () => {
    const track = vi.fn();
    const root = rootWith(
      `<div data-lm-place="p2">
         <details><summary class="lm-popup__more-summary">More</summary></details>
       </div>`,
    );
    trackLinks(root, track);

    const summary = root.querySelector("summary");
    const details = root.querySelector("details");

    summary?.click();
    // jsdom does not toggle <details> from a synthetic click, so the state the
    // capture listener reads is set here the way the browser would have.
    if (details) details.open = true;
    summary?.click();

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("fold", {
      k: "lm-popup__more-summary",
      id: "p2",
    });
  });
});
