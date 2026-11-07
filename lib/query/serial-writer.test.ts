import { describe, expect, it } from "vitest";

import { createSerialWriter } from "./serial-writer";

/** A send whose replies the test releases by hand, in any order it likes. */
function controlledSend() {
  const sent: number[] = [];
  const pending: { resolve: () => void; reject: (error: Error) => void }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const send = (value: number) => {
    sent.push(value);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);

    return new Promise<void>((resolve, reject) => {
      pending.push({
        resolve: () => {
          inFlight -= 1;
          resolve();
        },
        reject: (error) => {
          inFlight -= 1;
          reject(error);
        },
      });
    });
  };

  return { send, sent, pending, maxInFlight: () => maxInFlight };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createSerialWriter", () => {
  it("never has two sends in flight, and sends the latest value next", async () => {
    const remote = controlledSend();
    const writer = createSerialWriter(remote.send);

    void writer.write(1);
    void writer.write(2);
    void writer.write(3);
    await tick();

    // 2 was replaced by 3 before it ever went out.
    expect(remote.sent).toEqual([1]);

    remote.pending[0].resolve();
    await tick();
    expect(remote.sent).toEqual([1, 3]);

    remote.pending[1].resolve();
    await writer.idle();

    expect(remote.sent).toEqual([1, 3]);
    expect(remote.maxInFlight()).toBe(1);
    expect(writer.isBusy).toBe(false);
  });

  it("still sends the queued value after a failure", async () => {
    const remote = controlledSend();
    const writer = createSerialWriter(remote.send);

    void writer.write(1);
    void writer.write(2);
    await tick();

    remote.pending[0].reject(new Error("offline"));
    await tick();
    expect(remote.sent).toEqual([1, 2]);

    remote.pending[1].resolve();
    await writer.idle();
    expect(writer.isBusy).toBe(false);
  });

  it("idle waits for the last send, including one queued during the wait", async () => {
    const remote = controlledSend();
    const writer = createSerialWriter(remote.send);
    let settled = false;

    void writer.write(1);
    void writer.idle().then(() => {
      settled = true;
    });
    await tick();

    void writer.write(2);
    remote.pending[0].resolve();
    await tick();
    expect(settled).toBe(false);

    remote.pending[1].resolve();
    await tick();
    expect(settled).toBe(true);
  });

  it("is idle at once when nothing was written", async () => {
    const writer = createSerialWriter(async () => {});

    expect(writer.isBusy).toBe(false);
    await expect(writer.idle()).resolves.toBeUndefined();
  });
});
