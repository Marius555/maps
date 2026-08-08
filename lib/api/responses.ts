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
): NextResponse {
  return NextResponse.json({ error: { code, message, fields } }, { status });
}
