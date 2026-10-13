import { describe, expect, it } from "vitest";

import type { BatchGeocodeResult } from "@/lib/geocoding/types";
import { ApiError } from "@/lib/query/fetcher";
import { readGeocodeStream, splitLines } from "./geocode-stream";

function result(key: string): BatchGeocodeResult {
  return { key, candidate: null, alternatives: [], status: "failed" };
}

/** A response whose body arrives in exactly these pieces, as a network would. */
function streamed(pieces: string[]): Response {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const piece of pieces) controller.enqueue(encoder.encode(piece));
        controller.close();
      },
    }),
  );
}

const line = (value: unknown) => `${JSON.stringify(value)}\n`;

describe("splitLines", () => {
  it("keeps a half-arrived line for the next read", () => {
    expect(splitLines('{"a":1}\n{"b":')).toEqual({ lines: ['{"a":1}'], rest: '{"b":' });
  });

  it("ignores blank lines", () => {
    expect(splitLines('\n{"a":1}\n\n')).toEqual({ lines: ['{"a":1}'], rest: "" });
  });
});

describe("readGeocodeStream", () => {
  it("hands over each answer as it is read, then the pace", async () => {
    const seen: string[] = [];
    const body = line({ result: result("a") }) + line({ result: result("b") });

    const outcome = await readGeocodeStream(
      // Cut mid-line, the way a network chunk often ends.
      streamed([body.slice(0, 20), body.slice(20), line({ done: { paceMs: 220 } })]),
      (answer) => seen.push(answer.key),
    );

    expect(seen).toEqual(["a", "b"]);
    expect(outcome).toEqual({ paceMs: 220 });
  });

  it("raises a failure partway as the API error it stands for, after the answers before it", async () => {
    const seen: string[] = [];

    const reading = readGeocodeStream(
      streamed([
        line({ result: result("a") }),
        line({
          error: {
            code: "rate_limited",
            message: "The address lookup service is busy.",
            status: 429,
            retryAfterMs: 2000,
          },
        }),
      ]),
      (answer) => seen.push(answer.key),
    );

    await expect(reading).rejects.toMatchObject({ status: 429, retryAfterMs: 2000 });
    await expect(reading).rejects.toBeInstanceOf(ApiError);
    expect(seen).toEqual(["a"]);
  });

  it("treats a stream that ends without saying so as a dropped connection", async () => {
    const reading = readGeocodeStream(streamed([line({ result: result("a") })]), () => {});

    // No status: the run retries it like any connection that went away.
    await expect(reading).rejects.not.toHaveProperty("status");
  });
});
