import "server-only";

import type { NextResponse } from "next/server";

import { GeocoderError } from "@/lib/geocoding";
import { fail } from "./responses";

/**
 * An upstream geocoder being slow or rate-limiting us is neither the user's
 * mistake nor a bug on our side, so neither a 422 nor a bare 500 tells the truth.
 * Re-thrown if it is something else, so real bugs still reach the generic handler.
 */
export function geocoderFailure(error: unknown): NextResponse {
  if (error instanceof GeocoderError) {
    if (error.status === 429) {
      return fail(
        "rate_limited",
        "The address lookup service is busy. Wait a moment and try again.",
        429,
      );
    }

    return fail(
      "internal_error",
      "Couldn't reach the address lookup service. Try again in a moment.",
      502,
    );
  }

  // AbortSignal.timeout rejects with a TimeoutError DOMException.
  if (error instanceof Error && error.name === "TimeoutError") {
    return fail(
      "internal_error",
      "The address lookup timed out. Try again in a moment.",
      504,
    );
  }

  throw error;
}
