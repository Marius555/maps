import { NextResponse, type NextRequest } from "next/server";

import { isBot } from "@/lib/analytics/collect/bots";
import { deviceOf } from "@/lib/analytics/collect/device";
import { readVisitorGeo } from "@/lib/analytics/collect/geo-headers";
import { toErrorResponse } from "@/lib/api/route";
import {
  readCollectGate,
  recordSession,
} from "@/lib/repositories/analytics.repository";
import {
  collectSchema,
  MAX_BODY_BYTES,
  type CollectInput,
} from "@/lib/validation/collect.schema";
import { isDomainAllowed } from "@/lib/validation/domain.schema";

/**
 * Where a published map reports what its visitors did.
 *
 * **The only route in this app an anonymous stranger can reach and write
 * through**, and everything about it is shaped by that. The other end is
 * embed/src/track.ts, running on somebody else's website.
 *
 * It is not `withAuth`, obviously, and it is not `withoutAuth` either — that
 * wrapper exists for login and signup, which answer a person waiting for a
 * result. Nothing is waiting for this one: `sendBeacon` discards the response
 * before it arrives. So the contract here is different from every other handler
 * in this directory:
 *
 * **204 to almost everything.** A bot, an unknown map, a domain that is not on
 * the allowlist, a map over its monthly ceiling — all of them are dropped and
 * all of them answer 204. A stranger's page must learn nothing from us: not
 * which map ids exist, not which domains are allowed, not whether a map is
 * published. And an error status would print in the console of a customer's
 * site, which embed/src/index.ts is explicit must never happen.
 *
 * The one exception is a body we cannot read at all, which answers 4xx — that is
 * a bug in something of ours, and it should be visible while we still have a
 * chance to see it.
 *
 * **Cheap rejections first.** Size, then shape, then user agent, then the map.
 * The first three cost no database round trip, which is the difference between a
 * junk flood costing bandwidth and costing money.
 */

/** Nothing here reads a cookie, so nothing here may be cached or prerendered. */
export const dynamic = "force-dynamic";

/**
 * The beacon posts `text/plain`, which is CORS-safelisted and therefore skips
 * the preflight — one request per session instead of two. Browsers should never
 * ask for this, but a proxy or a fetch-based client might, and answering keeps
 * a customer's console clean.
 */
export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await readBody(request);
    if (body === null) return oversized();

    const payload = collectSchema.parse(JSON.parse(body));

    if (await shouldRecord(request, payload)) await store(request, payload);

    return accepted();
  } catch (error) {
    // Malformed JSON, or a payload that fails the schema. `toErrorResponse`
    // turns a ZodError into a 422 and anything unrecognised into a 500 without
    // leaking what broke.
    if (error instanceof SyntaxError) return badRequest();

    return toErrorResponse(error);
  }
}

/** The body, or null when it is longer than we agreed to read. */
async function readBody(request: NextRequest): Promise<string | null> {
  /*
   * The declared length first, so an oversized body is refused before it is
   * read. It is only a hint — a chunked request has none — so the text is
   * measured again below, but the hint is what stops us buffering a megabyte
   * somebody announced in advance.
   */
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;

  const text = await request.text();

  // Bytes, not characters. A search box full of emoji is four bytes a glyph.
  return new TextEncoder().encode(text).length > MAX_BODY_BYTES ? null : text;
}

/**
 * Is this a session worth storing?
 *
 * Ordered by cost. The first two questions are string tests; only the last one
 * touches the database, and it is cached per map for a minute
 * (lib/repositories/analytics.repository.ts).
 */
async function shouldRecord(
  request: NextRequest,
  payload: CollectInput,
): Promise<boolean> {
  if (isBot(request.headers.get("user-agent"))) return false;

  const gate = await readCollectGate(payload.m);
  if (!gate) return false;

  // Over the month's ceiling. The map keeps working for every visitor; it just
  // stops being measured until the month turns.
  if (gate.used >= gate.limit) return false;

  return isDomainAllowed(postingHost(request, payload), gate.allowedDomains);
}

/**
 * Which site this beacon came from.
 *
 * `Origin` first because the browser sets it and a page cannot forge it — which
 * matters, since this is the value the allowlist is checked against. `Referer`
 * is the fallback for a request whose referrer policy stripped the origin
 * header, and the payload's own `h` is the last resort: it is client-authored
 * and therefore worth exactly as much as the honesty of whoever sent it, which
 * is why it is third rather than first.
 */
function postingHost(request: NextRequest, payload: CollectInput): string {
  const origin = request.headers.get("origin");

  if (origin && origin !== "null") {
    try {
      return new URL(origin).hostname;
    } catch {
      // Fall through to the referrer.
    }
  }

  const referer = request.headers.get("referer");

  if (referer) {
    try {
      return new URL(referer).hostname;
    } catch {
      // Fall through to the payload.
    }
  }

  return payload.h;
}

async function store(
  request: NextRequest,
  payload: CollectInput,
): Promise<void> {
  const geo = readVisitorGeo(request.headers);

  await recordSession({
    mapId: payload.m,
    // Keys the row, so a session that flushes more than once — pressing
    // Directions hides the page, which flushes — stays one visit rather than
    // becoming several. See `sessionRowId` in the repository.
    sessionId: payload.s,
    startedAt: startedAt(payload),
    country: geo.country,
    city: geo.city,
    lat: geo.lat,
    lng: geo.lng,
    ip: geo.ip,
    host: payload.h,
    path: payload.p,
    referrer: payload.r,
    device: deviceOf(request.headers.get("user-agent")),
    events: payload.e,
  });
}

/**
 * When the session began, from our clock rather than the visitor's.
 *
 * The events carry offsets from the moment the map booted, so the largest of
 * them is how long the session had been running when the beacon fired. Now minus
 * that is the start, to within the flight time of one request.
 *
 * The browser's own clock is deliberately not sent and would not be trusted if
 * it were: a device whose date is a year out would file a session in the wrong
 * month, and the monthly ceiling and every figure on the dashboard are bucketed
 * by that date.
 */
function startedAt(payload: CollectInput): Date {
  const longest = payload.e.reduce((max, event) => Math.max(max, event.o), 0);

  return new Date(Date.now() - longest);
}

/*
 * The three answers. Bodiless on purpose: `sendBeacon` reads nothing, and a JSON
 * envelope here would be bytes sent to a page that has already been discarded.
 */

function accepted(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

function oversized(): NextResponse {
  return new NextResponse(null, { status: 413 });
}

function badRequest(): NextResponse {
  return new NextResponse(null, { status: 400 });
}
