import "server-only";

import { createHash } from "node:crypto";

import { ID, Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isConflict, toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import { MAX_EVENTS, type CollectEvent } from "@/lib/validation/collect.schema";
import { readEmbedSettings } from "@/lib/validation/embed-settings.schema";
import type { RepoContext } from "./context";
import { toMapSession } from "./mappers";
import { getMap } from "./maps.repository";
import { getUserPlan, SESSION_LIMITS } from "./plan-limits";
import type {
  DeviceKind,
  MapDailyRow,
  MapSession,
  MapSessionRow,
} from "./types";

/**
 * Visitor analytics: the one repository that writes on behalf of nobody.
 *
 * **Read this before touching it.** Every other repository in this directory
 * takes a `RepoContext` and authorises by map ownership — `getMap(ctx, mapId)`
 * on the first line, so a caller can only ever reach rows belonging to the user
 * whose session produced the request. `recordSession` cannot do that. Its caller
 * is an anonymous visitor on somebody else's website, and there is no user to
 * be.
 *
 * What stands in for authorisation is deliberately weaker and worth naming
 * honestly: the map must exist and be published, and the posting page's host
 * must satisfy the map's own `allowedDomains`. That is **anti-abuse, not
 * security** — the same thing §7 already says about the allowlist. A snapshot
 * URL is public, so anyone determined to write junk into a map's analytics can;
 * what this stops is the accidental and the casual, and the write ceiling below
 * is what stops any of it costing real money.
 *
 * Three consequences, all deliberate:
 *
 * - Session rows carry **no owner permission**. Every table in this app is
 *   created with empty table permissions and `rowSecurity: true`, so only the
 *   admin client reads them — and the only thing holding that client is the
 *   dashboard, which authorises properly. Giving a visitor's row an owner would
 *   be writing a permission on behalf of a user who was never here.
 * - Every *read* in this file takes a `RepoContext` and opens with `getMap`,
 *   exactly like the rest of the directory. The asymmetry is on the write side
 *   alone.
 * - Nothing here throws a `PlanLimitError`. A map at its ceiling is not a
 *   customer doing something wrong; the write is dropped, the map keeps working
 *   for every visitor, and the dashboard says collection is paused.
 */

/** What the collector needs to know before it writes anything. */
export type CollectGate = {
  ownerId: string;
  allowedDomains: string[];
  /** Sessions already recorded this calendar month, UTC. */
  used: number;
  /** What the owner's plan allows this month. */
  limit: number;
};

export type RecordSessionInput = {
  mapId: string;
  /**
   * The visitor's own id for this page load, from the payload's `s`.
   *
   * Not stored and not identifying — it is what keys the row, so a session that
   * flushes more than once stays one row. See `sessionRowId`.
   */
  sessionId: string;
  /** Server-side, never the browser's clock. */
  startedAt: Date;
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  ip: string | null;
  host: string;
  path: string;
  referrer: string;
  device: DeviceKind;
  events: CollectEvent[];
};

/*
 * The gate, cached in the process for a minute.
 *
 * Without this, every beacon costs three reads before its write — the map, the
 * owner's plan, and a count — which triples the per-session cost the whole
 * feature is justified by. With it, a map being loaded steadily costs about two
 * reads a minute however many visitors it has, and the write is the only
 * per-session cost left.
 *
 * The count is carried forward locally between refreshes, so a map that crosses
 * its ceiling stops within the minute rather than at the next refresh. It can
 * over-admit up to a minute of traffic, which is the correct way to be wrong: a
 * ceiling is a spend guard, and refusing a paying customer's visitors to save a
 * hundred rows would be the expensive mistake.
 *
 * Bounded, because one process may serve every map in the app. At the cap it is
 * emptied rather than evicted entry by entry — this is a cache, not a store, and
 * a cold entry costs two reads.
 */
type GateEntry = { gate: CollectGate | null; checkedAt: number };

const GATE_TTL_MS = 60_000;
const GATE_MAX_ENTRIES = 500;

const gates = new Map<string, GateEntry>();

/**
 * May this map record another session, and on whose terms?
 *
 * `null` for a map that does not exist or has never been published. An
 * unpublished map has no embed in the wild, so a beacon claiming to be one is
 * not a visitor.
 */
export async function readCollectGate(mapId: string): Promise<CollectGate | null> {
  const cached = gates.get(mapId);

  if (cached && Date.now() - cached.checkedAt < GATE_TTL_MS) return cached.gate;

  const gate = await loadCollectGate(mapId);

  if (gates.size >= GATE_MAX_ENTRIES) gates.clear();
  gates.set(mapId, { gate, checkedAt: Date.now() });

  return gate;
}

/** Only the four columns the gate asks about. */
type CollectMapRow = Models.Row & {
  userId: string;
  allowedDomains?: string[] | null;
  publishedAt?: string | null;
  settings?: string | null;
};

async function loadCollectGate(mapId: string): Promise<CollectGate | null> {
  try {
    const row = await admin.tablesDB.getRow<CollectMapRow>({
      databaseId: env.databaseId,
      tableId: TABLES.maps,
      rowId: mapId,
    });

    if (!row.publishedAt) return null;

    /*
     * The owner's switch, asked here as well as baked into the snapshot — and
     * the asymmetry is deliberate.
     *
     * Turning it **on** still needs a republish, because a live snapshot carries
     * no endpoint until one is written and the embed has nowhere to post.
     * Turning it **off** takes effect here, within a minute, on maps already out
     * in the world. Waiting for a republish would be defensible for a colour and
     * is not defensible for this: it is somebody withdrawing consent to record
     * their visitors, and the honest answer to that is to stop, not to stop
     * eventually.
     */
    if (!readEmbedSettings(parseSettings(row.settings)).analytics) return null;

    const [plan, used] = await Promise.all([
      getUserPlan(row.userId),
      countSessionsThisMonth(mapId),
    ]);

    return {
      ownerId: row.userId,
      allowedDomains: row.allowedDomains ?? [],
      used,
      limit: SESSION_LIMITS[plan].sessionsPerMonth,
    };
  } catch {
    /*
     * A missing map is the common case here rather than an exception: a snippet
     * left on a page outlives the map it pointed at. Answering null drops the
     * beacon quietly, which is also right for a second reason — a stranger's
     * site must never learn from us which of our ids exist.
     */
    return null;
  }
}

/** Sessions this map has recorded since the first of the month, UTC. */
async function countSessionsThisMonth(mapId: string): Promise<number> {
  const result = await admin.tablesDB.listRows<MapSessionRow>({
    databaseId: env.databaseId,
    tableId: TABLES.mapSessions,
    queries: [
      Query.equal("mapId", mapId),
      // String comparison on the YYYY-MM-DD bucket key, which is what that
      // column is for. Nothing here needs the rows, only the total.
      Query.greaterThanEqual("day", monthStart()),
      Query.limit(1),
    ],
  });

  return result.total;
}

/** The settings blob, never throwing — a row written by an older build still parses. */
function parseSettings(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function monthStart(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `${String(now.getUTCFullYear())}-${month}-01`;
}

/**
 * The row id for a session, derived from the map and the session's own id.
 *
 * **This is what makes "one row per session" true, and it used to be false.**
 * `ID.unique()` was here, on the assumption stated all over this feature: the
 * embed sends one beacon per session, so one beacon is one row. The embed does
 * do that — but "per session" is not "per page-hide", and the tracker flushes
 * whenever the page is hidden as well as when it is closed. Pressing Directions
 * opens a new tab, which hides the old one, which flushes. So the single most
 * important action on a store locator ended the "session" and started a new
 * row, and one visitor who pressed Directions twice was counted as three
 * visits. Measured on real rows before the fix: five rows carrying offsets from
 * one page load — 274ms, 31s, 42s, 237s, 265s.
 *
 * Hashed rather than concatenated because Appwrite caps a row id at 36
 * characters and a map id is already 20 of them. Hex only, so it can never
 * begin with the underscore Appwrite reserves.
 *
 * The session id is client-authored, like everything else in the payload, and
 * that is fine here: it is random per page load, it never leaves the visitor's
 * closure, and the worst a forged one can do is *merge* two of the sender's own
 * sessions into a single row. That direction is safe — the abuse this table
 * has to fear is many rows, not few.
 */
function sessionRowId(mapId: string, sessionId: string): string {
  return createHash("sha256")
    .update(`${mapId}:${sessionId}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Write one visitor's session.
 *
 * No `RepoContext`, no owner permission, and no plan error — see the head of
 * this file for all three.
 *
 * **Idempotent on the session id.** A second beacon from a session already
 * stored appends its events to that row rather than creating another; see
 * `sessionRowId`. The first write wins on everything that describes the
 * *visitor* — where they were, what they were using, which page they were on —
 * because those cannot change mid-session and the earliest reading is the one
 * taken closest to the moment they arrived.
 */
export async function recordSession(input: RecordSessionInput): Promise<void> {
  const rowId = sessionRowId(input.mapId, input.sessionId);
  const startedAt = input.startedAt.toISOString();

  try {
    await admin.tablesDB.createRow<MapSessionRow>({
      databaseId: env.databaseId,
      tableId: TABLES.mapSessions,
      rowId,
      data: {
        mapId: input.mapId,
        startedAt,
        day: startedAt.slice(0, 10),
        country: input.country,
        city: input.city,
        lat: input.lat,
        lng: input.lng,
        ip: input.ip,
        // Truncated to the columns' own widths rather than trusted: the payload
        // schema allows a 2KB path because a real URL can be one, and the
        // column is 255 because nothing that renders it shows more.
        host: input.host.slice(0, 255),
        path: input.path.slice(0, 255),
        referrer: input.referrer.slice(0, 255),
        device: input.device,
        events: JSON.stringify(input.events),
        eventCount: input.events.length,
      },
    });
  } catch (error) {
    // A row for this session already exists, so this is a later flush of it.
    if (isConflict(error)) return appendToSession(rowId, input.events);

    throw toRepositoryError(error);
  }

  // Keep the cached count honest between refreshes. Only a genuinely new row
  // counts against the ceiling — an append is the same visit.
  const cached = gates.get(input.mapId);
  if (cached?.gate) cached.gate.used += 1;
}

/**
 * Add a later flush's events to the session row already stored.
 *
 * Read-then-write rather than an append, because Appwrite has neither an array
 * append nor an atomic increment — the same absence the daily rollup exists to
 * work around. Two flushes racing can therefore lose one; that is accepted
 * rather than locked around, because the alternative costs every session a
 * write to a lock table to protect a case that needs a visitor to hide the page
 * twice inside one round trip.
 *
 * The cap is re-applied here, and it is the reason this cannot be used to grow
 * a row without bound: sixty events is sixty events however many beacons they
 * arrived in.
 */
async function appendToSession(
  rowId: string,
  events: CollectEvent[],
): Promise<void> {
  try {
    const existing = await admin.tablesDB.getRow<MapSessionRow>({
      databaseId: env.databaseId,
      tableId: TABLES.mapSessions,
      rowId,
    });

    const merged = [...parseEvents(existing.events), ...events].slice(
      0,
      MAX_EVENTS,
    );

    await admin.tablesDB.updateRow<MapSessionRow>({
      databaseId: env.databaseId,
      tableId: TABLES.mapSessions,
      rowId,
      data: { events: JSON.stringify(merged), eventCount: merged.length },
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** A stored row's events, or none — a row we cannot read is not a crash. */
function parseEvents(value: string | null | undefined): CollectEvent[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) ? (parsed as CollectEvent[]) : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Reads. These authorise like every other repository in this directory.
 * ------------------------------------------------------------------ */

/** Appwrite's hard ceiling for one page. */
const PAGE_SIZE = 100;

/**
 * Enough pages for a busy map's month without letting a runaway loop bill
 * anybody. Past this the dashboard is reading raw rows where it should be
 * reading a rollup, which is a bug to fix rather than a number to raise.
 */
const MAX_PAGES = 50;

/**
 * Every session for a map between two UTC days, inclusive.
 *
 * Read for the current day, which has no rollup because it is still changing,
 * and for rolling up a completed day the first time anyone asks for a range
 * containing it.
 */
export type SessionPage = {
  sessions: MapSession[];
  /**
   * The read hit `MAX_PAGES` and there are older sessions in the window it did
   * not see.
   *
   * It matters because of what the caller must **not** do with a truncated
   * read: write a rollup from it. A rollup is permanent and is never recomputed,
   * so a day folded from half its sessions would under-report that day forever.
   * A truncated range is recomputed on every load instead, which is slow and
   * correct rather than fast and wrong.
   */
  truncated: boolean;
};

export async function listSessions(
  ctx: RepoContext,
  mapId: string,
  fromDay: string,
  toDay: string,
): Promise<SessionPage> {
  // Ownership first, exactly like every other read in this directory.
  await getMap(ctx, mapId);

  const sessions: MapSession[] = [];
  let cursor: string | null = null;

  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const queries = [
        Query.equal("mapId", mapId),
        Query.greaterThanEqual("day", fromDay),
        Query.lessThanEqual("day", toDay),
        Query.orderDesc("startedAt"),
        Query.limit(PAGE_SIZE),
      ];

      if (cursor) queries.push(Query.cursorAfter(cursor));

      const result = await admin.tablesDB.listRows<MapSessionRow>({
        databaseId: env.databaseId,
        tableId: TABLES.mapSessions,
        queries,
      });

      sessions.push(...result.rows.map(toMapSession));

      if (result.rows.length < PAGE_SIZE) return { sessions, truncated: false };
      cursor = result.rows[result.rows.length - 1].$id;
    }
  } catch (error) {
    throw toRepositoryError(error);
  }

  return { sessions, truncated: true };
}

/**
 * The newest sessions in a window, for the visitors table.
 *
 * A separate one-page read rather than a slice of the fold above, because the
 * two want different things: the fold wants every session in ninety days and is
 * usually answered from `mapDaily` without touching a raw row at all, while this
 * wants the last hundred and always needs raw rows. Deriving one from the other
 * would mean paging a quarter's traffic to draw a hundred lines.
 */
export async function listRecentSessions(
  ctx: RepoContext,
  mapId: string,
  fromDay: string,
  toDay: string,
  limit = PAGE_SIZE,
): Promise<MapSession[]> {
  await getMap(ctx, mapId);

  try {
    const result = await admin.tablesDB.listRows<MapSessionRow>({
      databaseId: env.databaseId,
      tableId: TABLES.mapSessions,
      queries: [
        Query.equal("mapId", mapId),
        Query.greaterThanEqual("day", fromDay),
        Query.lessThanEqual("day", toDay),
        Query.orderDesc("startedAt"),
        Query.limit(Math.min(limit, PAGE_SIZE)),
      ],
    });

    return result.rows.map(toMapSession);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export type DailyRollup = {
  day: string;
  sessions: number;
  views: number;
  interactions: number;
  /** Whatever lib/analytics/aggregate.ts folded for that day. */
  totals: Record<string, unknown>;
};

/** The rollups already written for a range. Days with no row are simply absent. */
export async function listDailyRollups(
  ctx: RepoContext,
  mapId: string,
  fromDay: string,
  toDay: string,
): Promise<DailyRollup[]> {
  await getMap(ctx, mapId);

  try {
    const result = await admin.tablesDB.listRows<MapDailyRow>({
      databaseId: env.databaseId,
      tableId: TABLES.mapDaily,
      queries: [
        Query.equal("mapId", mapId),
        Query.greaterThanEqual("day", fromDay),
        Query.lessThanEqual("day", toDay),
        Query.orderAsc("day"),
        // A range is at most 90 days, so one page always covers it.
        Query.limit(PAGE_SIZE),
      ],
    });

    return result.rows.map((row) => ({
      day: row.day,
      sessions: row.sessions ?? 0,
      views: row.views ?? 0,
      interactions: row.interactions ?? 0,
      totals: parseTotals(row.totals),
    }));
  } catch (error) {
    throw toRepositoryError(error);
  }
}

function parseTotals(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Store one completed day's figures.
 *
 * **A duplicate is success, not failure.** Two dashboard requests can enter the
 * same lazy rollup at once; the unique index on (mapId, day) is what makes the
 * second a 409 rather than a second row that would double every figure on the
 * page. Swallowing it is the whole reason that index exists.
 */
export async function writeDailyRollup(
  ctx: RepoContext,
  mapId: string,
  rollup: DailyRollup,
): Promise<void> {
  await getMap(ctx, mapId);

  try {
    await admin.tablesDB.createRow<MapDailyRow>({
      databaseId: env.databaseId,
      tableId: TABLES.mapDaily,
      rowId: ID.unique(),
      data: {
        mapId,
        day: rollup.day,
        sessions: rollup.sessions,
        views: rollup.views,
        interactions: rollup.interactions,
        totals: JSON.stringify(rollup.totals),
      },
    });
  } catch (error) {
    // Somebody else rolled this day up between our read and our write. Asked of
    // the Appwrite exception rather than of our own translated error, because
    // `toRepositoryError` answers `unknown` by design — it hands anything it
    // does not recognise straight back so the route layer makes it a 500.
    if (isConflict(error)) return;

    throw toRepositoryError(error);
  }
}
