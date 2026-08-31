import "server-only";

import type { NextResponse } from "next/server";

import { RoutingError, isTimeout } from "@/lib/routing";
import { fail } from "./responses";

/**
 * The routing engine being slow or rate-limiting us is neither the user's
 * mistake nor a bug on our side, so neither a 422 nor a bare 500 tells the truth.
 * Re-thrown if it is something else, so real bugs still reach the generic handler
 * — the same shape, and the same reasoning, as geocoder-errors.ts.
 */
export function routerFailure(error: unknown): NextResponse {
  // Checked before the class, because an aborted fetch can surface either as the
  // DOMException itself or wrapped as the cause of a RoutingError.
  if (isTimeout(error)) {
    return fail(
      "internal_error",
      "Working out the route took too long. Try again in a moment.",
      504,
    );
  }

  if (error instanceof RoutingError) {
    if (error.status === 429) {
      return fail(
        "rate_limited",
        "The routing service is busy. Wait a moment and try again.",
        429,
      );
    }

    // The user sees "couldn't reach it", which is all they can act on. The
    // upstream status is the whole difference between a blocked client (403), an
    // overloaded instance (503) and a request we built wrong (400).
    console.error(
      `Routing failure: status=${error.status ?? "none"} ${error.message}`,
      error.cause ?? "",
    );

    return fail(
      "internal_error",
      "Couldn't reach the routing service. Try again in a moment.",
      502,
    );
  }

  throw error;
}
