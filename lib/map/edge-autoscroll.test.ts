// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scrollableAncestor, startEdgeAutoScroll } from "./edge-autoscroll";

/**
 * A hand-driven frame clock.
 *
 * jsdom's own `requestAnimationFrame` is a timer we would have to guess at, and
 * the thing under test is a loop — so the frames are stepped explicitly. That
 * also makes "does it stop?" answerable: an unstopped loop leaves a pending
 * callback behind, and `pending()` says so.
 */
function frameClock() {
  let next = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = next++;
    callbacks.set(id, callback);
    return id;
  });

  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    callbacks.delete(id);
  });

  return {
    pending: () => callbacks.size,
    /** Runs whatever is queued, once per frame. */
    step: (frames = 1) => {
      for (let i = 0; i < frames; i += 1) {
        const queued = [...callbacks.entries()];
        callbacks.clear();
        for (const [, callback] of queued) callback(0);
      }
    },
  };
}

/**
 * A scroller that behaves like a laid-out one.
 *
 * jsdom lays nothing out: `scrollHeight` and `clientHeight` are 0 and
 * `getBoundingClientRect` is all zeroes. `scrollTop` is worse than absent — it
 * is writable and *unclamped*, so without this it would happily accept 5500px
 * of scroll on 2000px of content and the "stop at the end" behaviour would be
 * untestable. Clamping it here is not fudging the test; it is supplying the one
 * browser behaviour the code is written against.
 */
function scroller({
  top = 0,
  height = 500,
  content = 2000,
}: { top?: number; height?: number; content?: number } = {}) {
  const element = document.createElement("div");
  element.style.overflowY = "auto";

  Object.defineProperty(element, "clientHeight", { value: height });
  Object.defineProperty(element, "scrollHeight", { value: content });

  let scrollTop = 0;
  Object.defineProperty(element, "scrollTop", {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = Math.max(0, Math.min(value, content - height));
    },
  });

  element.getBoundingClientRect = () =>
    ({ top, bottom: top + height, height }) as DOMRect;

  document.body.appendChild(element);
  return element;
}

let clock: ReturnType<typeof frameClock>;

beforeEach(() => {
  clock = frameClock();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("startEdgeAutoScroll", () => {
  it("does nothing while the pointer is away from both edges", () => {
    const element = scroller();
    const auto = startEdgeAutoScroll(element);

    auto.update(250);
    clock.step(5);

    expect(element.scrollTop).toBe(0);
    expect(clock.pending()).toBe(0);
    auto.stop();
  });

  it("pulls the container down near its bottom edge", () => {
    const element = scroller();
    const auto = startEdgeAutoScroll(element);

    auto.update(498);
    clock.step(5);

    expect(element.scrollTop).toBeGreaterThan(0);
    auto.stop();
  });

  it("pulls it back up near the top edge", () => {
    const element = scroller();
    element.scrollTop = 400;

    const auto = startEdgeAutoScroll(element);
    auto.update(2);
    clock.step(5);

    expect(element.scrollTop).toBeLessThan(400);
    auto.stop();
  });

  it("pulls harder the deeper into the band the pointer is", () => {
    const shallow = scroller();
    const deep = scroller();

    const a = startEdgeAutoScroll(shallow);
    const b = startEdgeAutoScroll(deep);

    // Just inside the band, versus right on the edge.
    a.update(450);
    b.update(499);
    clock.step(3);

    expect(deep.scrollTop).toBeGreaterThan(shallow.scrollTop);
    a.stop();
    b.stop();
  });

  it("gives up at the end rather than spinning frames forever", () => {
    const element = scroller();
    const auto = startEdgeAutoScroll(element);

    auto.update(499);
    clock.step(400);

    // At the bottom, and the loop noticed the scrollTop it asked for did not
    // happen and stopped asking rather than burning a frame a tick forever.
    expect(element.scrollTop).toBe(1500);
    expect(clock.pending()).toBe(0);
    auto.stop();
  });

  it("stops on release, and stays stopped", () => {
    const element = scroller();
    const auto = startEdgeAutoScroll(element);

    auto.update(499);
    clock.step(2);
    const moved = element.scrollTop;

    auto.stop();
    clock.step(10);

    expect(element.scrollTop).toBe(moved);
    expect(clock.pending()).toBe(0);
  });

  it("stops when the pointer leaves the band again", () => {
    const element = scroller();
    const auto = startEdgeAutoScroll(element);

    auto.update(499);
    clock.step(2);
    const moved = element.scrollTop;

    auto.update(250);
    clock.step(10);

    expect(element.scrollTop).toBe(moved);
    auto.stop();
  });
});

describe("scrollableAncestor", () => {
  it("finds the nearest scrolling ancestor", () => {
    const element = scroller();
    const middle = document.createElement("ul");
    const row = document.createElement("li");
    element.appendChild(middle);
    middle.appendChild(row);

    expect(scrollableAncestor(row)).toBe(element);
  });

  it("ignores an auto container with nothing to scroll", () => {
    // The Locations *tab* renders the same rows with no panel around them, and
    // an `auto` box that fits its content must not capture the drag.
    const element = scroller({ content: 500 });
    const row = document.createElement("li");
    element.appendChild(row);

    expect(scrollableAncestor(row)).toBeNull();
  });

  it("returns null when nothing above the row scrolls", () => {
    const plain = document.createElement("div");
    const row = document.createElement("li");
    plain.appendChild(row);
    document.body.appendChild(plain);

    expect(scrollableAncestor(row)).toBeNull();
  });
});
