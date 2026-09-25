// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { visibleDeadline } from "./visible-deadline";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("visibleDeadline", () => {
  it("expires after the given time while the page stays visible", () => {
    const expired = vi.fn();
    visibleDeadline(1000, expired);

    vi.advanceTimersByTime(999);
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expired).toHaveBeenCalledOnce();
  });

  it("does not count time the page spends hidden", () => {
    const expired = vi.fn();
    visibleDeadline(1000, expired);

    vi.advanceTimersByTime(600);
    setVisibility("hidden");
    vi.advanceTimersByTime(60_000);
    expect(expired).not.toHaveBeenCalled();

    setVisibility("visible");
    vi.advanceTimersByTime(399);
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expired).toHaveBeenCalledOnce();
  });

  it("does not start counting until a hidden page becomes visible", () => {
    visibility = "hidden";
    const expired = vi.fn();
    visibleDeadline(1000, expired);

    vi.advanceTimersByTime(60_000);
    expect(expired).not.toHaveBeenCalled();

    setVisibility("visible");
    vi.advanceTimersByTime(1000);
    expect(expired).toHaveBeenCalledOnce();
  });

  it("never fires once cancelled, even across visibility changes", () => {
    const expired = vi.fn();
    const cancel = visibleDeadline(1000, expired);

    cancel();
    setVisibility("hidden");
    setVisibility("visible");
    vi.advanceTimersByTime(5000);
    expect(expired).not.toHaveBeenCalled();
  });
});
