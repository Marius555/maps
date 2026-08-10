import "server-only";

import type { NextResponse } from "next/server";

import { GeocoderError, isTimeout } from "@/lib/geocoding";
import { fail } from "./responses";

/**
 * An upstream geocoder being slow or rate-limiting us is neither the user's
 * mistake nor a bug on our side, so neither a 422 nor a bare 500 tells the truth.
 * Re-thrown if it is something else, so real bugs still reach the generic handler.
 */
export function geocoderFailure(error: unknown): NextResponse {
  // Checked before the class, because an aborted fetch can surface either as the
  // DOMException itself or wrapped as the cause of a GeocoderError.
  if (isTimeout(error)) {
    return fail(
      "internal_error",
      "The address lookup timed out. Try again in a moment.",
      504,
    );
  }

  if (error instanceof GeocoderError) {
    if (error.status === 429) {
      return fail(
        "rate_limited",
        "The address lookup service is busy. Wait a moment and try again.",
        429,
      );
    }

    /*
     * The one line that makes the next occurrence diagnosable.
     *
     * The user sees "couldn't reach it", which is all they can act on, but the
     * upstream status is the whole difference between a blocked client (403), an
     * overloaded instance (503) and a query we built wrong (400) — and it used to
     * be discarded here, leaving nothing in the logs but the symptom.
     */
    console.error(
      `Geocoder failure: status=${error.status ?? "none"} ${error.message}`,
      error.cause ?? "",
    );

    return fail(
      "internal_error",
      "Couldn't reach the address lookup service. Try again in a moment.",
      502,
    );
  }

  throw error;
}
