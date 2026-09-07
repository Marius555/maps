import { NextResponse } from "next/server";

import type { ApiErrorCode, ApiFieldErrors } from "./error-codes";

/**
 * The single JSON envelope. Success is `{ data }`, failure is `{ error }`, and
 * nothing else ever comes out of an API route.
 */

export function ok<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 200 });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function fail(
  code: ApiErrorCode,
  message: string,
  status: number,
  fields?: ApiFieldErrors,
  /**
   * Seconds to wait before trying again, sent as the standard `Retry-After`.
   *
   * Only the caller knows whether waiting is even the right response, so this is
   * opt-in rather than derived from the status. It exists for the geocoder's
   * 429: an import walks a file in a hundred and twenty chunks, and a client
   * that has to guess how long to back off either gives up too early or sits out
   * an outage that ended seconds ago.
   */
  retryAfterSeconds?: number,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, fields } },
    {
      status,
      headers:
        retryAfterSeconds === undefined
          ? undefined
          : { "retry-after": String(Math.max(0, Math.ceil(retryAfterSeconds))) },
    },
  );
}
