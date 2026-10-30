import { NextResponse } from "next/server";

import type { ApiErrorBody } from "@/lib/api/error-codes";
import { geocoderFailure } from "@/lib/api/geocoder-errors";
import { parseBody, withMapAuth } from "@/lib/api/route";
import { getGeocoder, statusFor } from "@/lib/geocoding";
import {
  GEOCODE_STREAM_CONTENT_TYPE,
  type GeocodeStreamError,
  type GeocodeStreamLine,
} from "@/lib/import/geocode-stream";
import { getMap } from "@/lib/repositories/maps.repository";
import { assertPlaceHeadroom } from "@/lib/repositories/places.repository";
import {
  assertLookupHeadroom,
  lookupMeter,
} from "@/lib/repositories/usage.repository";
import { IN_FLIGHT_LIMITS } from "@/lib/limits/rate";
import { inFlight } from "@/lib/rate-limit/limiter";
import { geocodeBatchSchema } from "@/lib/validation/geocode.schema";

type Params = { id: string };

/*
 * A chunk of 25 rows was measured at about nineteen seconds (2026-10-12: roughly
 * 750ms a lookup, the provider's pacing plus its latency plus the usage meter).
 * There used to be a `maxDuration = 60` here; it is a Vercel setting and does
 * nothing on Appwrite Sites, which cuts every request at 30 seconds (CLAUDE.md
 * §12). What protects the bill from a chunk killed mid-flight is `lookupMeter`,
 * which records as it goes.
 */

/**
 * Geocodes a chunk of an import.
 *
 * Nothing is written here — results go back to the client for the review step,
 * and only a confirmed review creates places. That is CLAUDE.md §7's "never save
 * geocode results silently", enforced by the endpoint having no write path at all.
 *
 * One row failing must not fail the chunk: a single unresolvable address in a
 * 500-row CSV would otherwise block the whole import.
 *
 * **The plan check happens before the geocoder runs, not after.** This endpoint
 * spends requests against a rate-limited, metered upstream, and until this guard
 * existed the only ceiling was at insert time in `createPlaces` — so a free-plan
 * map with ten slots could walk a 500-row file through the geocoder and be
 * refused at the end, having spent all 500. §6 is explicit that a limit lives in
 * the repository and not only in the UI; the wizard's own headroom banner is the
 * courtesy, this is the rule.
 *
 * **It is checked against the run, not the chunk**, and that is the difference
 * between a guard and a formality. `existing + 25 > limit` is false for almost
 * every chunk of almost every file — a map with ten free slots has room for any
 * twenty-five rows — so the old form let the entire file through and refused at
 * the end anyway. `runTotal` is what the client says the whole import will
 * create, so the *first* chunk is the one that gets refused.
 *
 * **What used to be left open, and now is not.** Geocoding writes nothing, so the
 * server could not see how far an import had already got, and `runTotal` is a
 * number the *client* chose — so a scripted caller could understate it, or re-send
 * chunk after chunk that each fit the headroom on their own, and spend without
 * limit. `assertLookupHeadroom` closes that: the count is kept per account in the
 * `usage` table, so it survives the request that caused it and no number the
 * client sends can talk it down. `runTotal` still earns its place — it is what
 * makes the *first* chunk the one refused when a file plainly will not fit — but
 * it is no longer the only thing standing between a stranger and our bill.
 */
export const POST = withMapAuth<Params>(async ({ request, params, ctx }) => {
  await getMap(ctx, params.id);

  const input = await parseBody(request, geocodeBatchSchema);

  await assertPlaceHeadroom(
    ctx,
    params.id,
    Math.max(input.runTotal ?? 0, input.rows.length),
  );

  /*
   * Only rows with an address reach the geocoder, so only those are asserted for.
   * Counting the blank ones would refuse an import for lookups it was never going
   * to make — and a file with an unmapped address column is mostly blank rows.
   *
   * `interactive`, not `background`: an import is somebody sitting in the wizard
   * watching a progress bar, even though it is long. The thing that stands aside
   * for it is the routability sweep.
   */
  const billable = input.rows.filter((row) => Boolean(row.address)).length;

  await assertLookupHeadroom(ctx.workspaceId, billable, "interactive");

  /*
   * One batch at a time per account. The headroom check above runs before any
   * of this batch is recorded, so two batches side by side could each pass it
   * with room for only one; the import wizard sends them one after another
   * anyway, and a 429 here is what its retry already waits out.
   *
   * Taken last, directly before the `try` whose `finally` releases it. Anything
   * that can throw between the two — `getGeocoder()` with a provider
   * misconfigured, say — would otherwise hold this account's slot for the life
   * of the process, and every later batch would be refused with a 429.
   */
  const meter = lookupMeter(ctx.workspaceId);
  const release = inFlight(`geocodeBatch:${ctx.workspaceId}`, IN_FLIGHT_LIMITS.geocodeBatch);

  /*
   * Each answer is written the moment it is found — `lib/import/geocode-stream.ts`
   * has the format and the reason. Everything above has already answered any
   * refusal as an ordinary JSON error; from here the status is 200 and a failure
   * is a line.
   *
   * The slot and the meter are released in the stream's own `finally`, not the
   * handler's: the handler returns as soon as the headers go, while the lookups
   * are still running.
   */
  let isCancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: GeocodeStreamLine) => {
        if (!isCancelled) controller.enqueue(encodeLine(line));
      };

      try {
        const geocoder = getGeocoder();

        // Sequential by design. The provider throttle serialises these anyway,
        // and Promise.all would only queue them all up front with no ordering
        // benefit — and the order is what the progress bar walks.
        for (const row of input.rows) {
          // Skip aborts the request; stop spending lookups on an answer nobody
          // is waiting for.
          if (isCancelled || request.signal.aborted) break;

          if (!row.address) {
            send({
              result: { key: row.key, candidate: null, alternatives: [], status: "failed" },
            });
            continue;
          }

          const candidates = await geocoder.search({
            address: row.address,
            countryCode: input.countryCode,
            limit: 5,
          });
          await meter.spent();

          const [best = null, ...alternatives] = candidates;

          send({
            result: { key: row.key, candidate: best, alternatives, status: statusFor(best) },
          });
        }

        /*
         * The pacing goes back with the results. A number of milliseconds and
         * never the provider's name: which service answered stays inside
         * /lib/geocoding (§7).
         */
        send({ done: { paceMs: geocoder.paceMs } });
      } catch (error) {
        send({ error: await failureOf(error) });
      } finally {
        await meter.flush();
        release();

        if (!isCancelled) controller.close();
      }
    },

    cancel() {
      isCancelled = true;
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "content-type": GEOCODE_STREAM_CONTENT_TYPE,
      // Every layer that might hold the lines back until the end, told not to.
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}, { rateLimit: "metered" });

const encoder = new TextEncoder();

function encodeLine(line: GeocodeStreamLine): Uint8Array {
  return encoder.encode(`${JSON.stringify(line)}
`);
}

/**
 * A failure partway through, as the line that says so.
 *
 * Mapped by `geocoderFailure`, the same function that answered it when this was
 * one JSON response, so the status, the message and the `Retry-After` the run's
 * retry policy reads are all unchanged. Anything it does not recognise is a bug,
 * logged here because nothing above this will see it.
 */
async function failureOf(error: unknown): Promise<GeocodeStreamError> {
  try {
    const response = geocoderFailure(error);
    const body = (await response.json()) as ApiErrorBody;
    const retryAfter = Number(response.headers.get("retry-after"));

    return {
      code: body.error.code,
      message: body.error.message,
      status: response.status,
      ...(retryAfter > 0 ? { retryAfterMs: retryAfter * 1000 } : {}),
    };
  } catch {
    console.error("Geocode batch failed partway", error);

    return {
      code: "internal_error",
      message: "Something broke on our side. Try again in a moment.",
      status: 500,
    };
  }
}
