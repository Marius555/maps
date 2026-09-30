import "server-only";

import type { Delta } from "@/lib/analytics/view";
import { requireAdmin } from "@/lib/admin/auth/guard";
import { SPLIT_COLORS } from "@/lib/admin/colors";
import {
  countPlacesByMap,
  listAllMaps,
  readContentTotals,
  type ContentTotals,
} from "@/lib/repositories/admin/content";
import { countSessionsByDay, sampleSessions } from "@/lib/repositories/admin/sessions";
import { listAllUsers } from "@/lib/repositories/admin/users";
import type { AdminRange } from "@/lib/validation/admin.schema";
import { countByDay, deltaOf, periodOf, seriesOf, sum, tallyBy, type DayPoint } from "./period";
import type { Slice } from "./users";

export type MapTableRow = {
  id: string;
  name: string;
  owner: string;
  places: number;
  createdAt: string;
  publishedAt: string | null;
};

export type ContentMetrics = {
  totals: ContentTotals;
  mapsCreated: Delta;
  mapSeries: DayPoint[];
  mapPrevious: DayPoint[];
  sessions: Delta;
  sessionSeries: DayPoint[];
  sessionPrevious: DayPoint[];
  countries: { key: string; label: string; value: number }[];
  hosts: { key: string; label: string; value: number }[];
  devices: Slice[];
  sampleSize: number;
  sampleTruncated: boolean;
  maps: MapTableRow[];
};

/** How many of the newest maps get a per-map location count. */
const COUNTED_MAPS = 60;

const DEVICE_LABEL: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
};

export async function loadContentMetrics(range: AdminRange): Promise<ContentMetrics> {
  await requireAdmin();

  const period = periodOf(range);

  const [totals, maps, sessionCounts, sample, { users }] = await Promise.all([
    readContentTotals(),
    listAllMaps(),
    countSessionsByDay([...period.previousDays, ...period.days]),
    sampleSessions(period.fromDay),
    listAllUsers(),
  ]);

  const placeCounts = await countPlacesByMap(maps.slice(0, COUNTED_MAPS).map((map) => map.id));
  const owners = new Map(users.map((user) => [user.id, user.email]));

  const created = maps.map((map) => map.createdAt);
  const mapSeries = countByDay(created, period.days);
  const mapPrevious = countByDay(created, period.previousDays);
  const sessionSeries = seriesOf(sessionCounts, period.days);
  const sessionPrevious = seriesOf(sessionCounts, period.previousDays);

  const devices = tallyBy(sample.sessions, (session) => session.device);

  return {
    totals,
    mapsCreated: deltaOf(sum(mapSeries), sum(mapPrevious)),
    mapSeries,
    mapPrevious,
    sessions: deltaOf(sum(sessionSeries), sum(sessionPrevious)),
    sessionSeries,
    sessionPrevious,
    countries: tallyBy(sample.sessions, (session) => session.country)
      .slice(0, 8)
      .map((entry) => ({ key: entry.key, label: entry.key, value: entry.count })),
    hosts: tallyBy(sample.sessions, (session) => session.host)
      .slice(0, 8)
      .map((entry) => ({ key: entry.key, label: entry.key, value: entry.count })),
    devices: devices.slice(0, 3).map((entry, position) => ({
      key: entry.key,
      label: DEVICE_LABEL[entry.key] ?? entry.key,
      value: entry.count,
      color: SPLIT_COLORS[position],
    })),
    sampleSize: sample.sessions.length,
    sampleTruncated: sample.truncated,
    maps: maps.slice(0, COUNTED_MAPS).map((map) => ({
      id: map.id,
      name: map.name,
      owner: owners.get(map.userId) ?? "Deleted account",
      places: placeCounts.get(map.id) ?? 0,
      createdAt: map.createdAt,
      publishedAt: map.publishedAt,
    })),
  };
}
