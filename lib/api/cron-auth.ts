import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { fail } from "@/lib/api/responses";

/**
 * The scheduled function's credential: `Authorization: Bearer <CRON_SECRET>`.
 *
 * **Refuses everyone while `CRON_SECRET` is unset**, rather than answering
 * anyone who finds the URL: an open trigger would let a stranger spend our
 * geocoding credit, republish every linked map, or run the purge on demand.
 *
 * Returns the response to send, or null when the caller is the function.
 */
export function refuseUnlessCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret || !authorized(request.headers.get("authorization"), secret)) {
    return fail("unauthorized", "Not allowed.", 401);
  }

  return null;
}

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
