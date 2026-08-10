import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createThrottle } from "./throttle";

/**
 * Fake timers throughout, and every advance goes through
 * `advanceTimersByTimeAsync` so the microtask chain between the internal sleep
 * and the task itself flushes. `advanceTimersByTime` would move the clock without
 * ever letting the `.then(task)` run, and every assertion below would read zero.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * A task that records when it started and hands back a promise the test decides
 * when to settle — which is the whole point here. What is being tested is when a
 * task *starts*, and a task that resolves immediately cannot tell a pacer that
 * waits for completion apart from one that doesn't.
 */
function trackedTask() {
  let release: (value: string) => void = () => {};
  const started: number[] = [];

  const task = () => {
    started.push(Date.now());
    return new Promise<string>((resolve) => {
      release = resolve;
    });
  };

  return { task, started, release: (value = "done") => release(value) };
}

describe("createThrottle", () => {
  it("runs the first task without waiting", async () => {
    const throttle = createThrottle(1000);
    const { task, started } = trackedTask();

    void throttle(task);
    await vi.advanceTimersByTimeAsync(0);

    expect(started).toHaveLength(1);
  });

  it("never runs a task synchronously", () => {
    const throttle = createThrottle(0);
    let hasRun = false;

    void throttle(async () => {
      hasRun = true;
    });

    // Still false: a caller must be able to finish its own work before the task
    // it queued starts running.
    expect(hasRun).toBe(false);
  });

  it("spaces starts by the interval when callers arrive together", async () => {
    const throttle = createThrottle(1000);
    const { task, started } = trackedTask();

    void throttle(task);
    void throttle(task);
    void throttle(task);

    await vi.advanceTimersByTimeAsync(0);
    expect(started).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(started).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(started).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(started).toHaveLength(3);
  });

  /**
   * The regression this rewrite exists for. The old promise chain started the
   * next task only once the previous one had settled, so a task that never
   * settles blocked the queue forever.
   */
  it("does not wait for the previous task to finish", async () => {
    const throttle = createThrottle(1000);
    const { task, started } = trackedTask();

    // Queued, never released.
    void throttle(task);
    void throttle(task);

    await vi.advanceTimersByTimeAsync(1000);

    expect(started).toHaveLength(2);
  });

  /**
   * The user-visible shape of the bug: an interactive pin drop landing behind a
   * ten-row import chunk. Under the old chain each row cost latency + interval,
   * so this took about sixty seconds; it should now cost the pacing alone.
   */
  it("makes a request behind a slow batch wait only the pacing", async () => {
    const throttle = createThrottle(1000);
    const slow = () => new Promise<void>((resolve) => setTimeout(resolve, 5000));

    for (let row = 0; row < 10; row += 1) void throttle(slow);

    const { task, started } = trackedTask();
    void throttle(task);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(started).toHaveLength(1);
  });

  it("does not let a rejected task stall the queue", async () => {
    const throttle = createThrottle(1000);
    const { task, started } = trackedTask();

    const first = throttle(() => Promise.reject(new Error("boom")));
    void throttle(task);

    await expect(first).rejects.toThrow("boom");

    await vi.advanceTimersByTimeAsync(1000);
    expect(started).toHaveLength(1);
  });

  it("hands the task's own value back to the caller", async () => {
    const throttle = createThrottle(1000);

    const result = throttle(() => Promise.resolve(7));
    await vi.advanceTimersByTimeAsync(0);

    await expect(result).resolves.toBe(7);
  });

  it("banks no credit while idle", async () => {
    const throttle = createThrottle(1000);
    const { task, started } = trackedTask();

    void throttle(task);
    await vi.advanceTimersByTimeAsync(5000);
    expect(started).toHaveLength(1);

    // The slot is clamped to now rather than sitting 4 seconds in the past, so
    // this starts immediately and the one after it still waits a full interval.
    void throttle(task);
    void throttle(task);
    await vi.advanceTimersByTimeAsync(0);

    expect(started).toHaveLength(2);
  });

  it("starts everything on the next tick when the interval is zero", async () => {
    // `readInterval` in photon.ts accepts 0, which a self-hosted instance may use.
    const throttle = createThrottle(0);
    const { task, started } = trackedTask();

    void throttle(task);
    void throttle(task);
    void throttle(task);

    await vi.advanceTimersByTimeAsync(0);

    expect(started).toHaveLength(3);
  });
});
