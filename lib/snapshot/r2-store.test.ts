import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MapSnapshot } from "@/packages/shared/snapshot";

/**
 * Where a publish lands on R2, in what order, with what caching.
 *
 * The order is the recoverability argument: archive first, so a publish that
 * dies before the live write leaves the previous live file serving. The cache
 * headers are the cost argument — the zone's cache rule respects them, and a
 * live file that forgot its max-age would be a paid R2 read per visitor.
 */

vi.mock("@/lib/env", () => ({
  env: { snapshotPublicUrl: "https://cdn.example.com", r2SnapshotBucket: "snapshots" },
}));

type Put = { key: string; body: string; cacheControl: string; contentType: string };

const objects = new Map<string, string>();
const puts: Put[] = [];
const removed: string[] = [];

vi.mock("@/lib/r2/client", () => ({
  r2Bucket: () => ({
    async put(key: string, body: string, headers: { contentType: string; cacheControl: string }) {
      puts.push({ key, body, ...headers });
      objects.set(key, body);
    },
    async list(prefix: string) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
    },
    async remove(key: string) {
      removed.push(key);
      objects.delete(key);
    },
  }),
}));

import { deleteSnapshots, pruneArchives, uploadSnapshot } from "./r2-store";

function snapshot(generatedAt: string, mapId = "map-1"): MapSnapshot {
  return { version: 1, mapId, generatedAt } as MapSnapshot;
}

beforeEach(() => {
  objects.clear();
  puts.length = 0;
  removed.length = 0;
});

describe("uploadSnapshot", () => {
  it("writes the archive, then the live file, and returns the public live URL", async () => {
    const published = snapshot("2026-09-19T20:15:30.123Z");

    const result = await uploadSnapshot(published);

    expect(puts.map((put) => put.key)).toEqual([
      "map-1/2026-09-19T20-15-30-123Z.json",
      "map-1/live.json",
    ]);
    expect(puts[0].body).toBe(JSON.stringify(published));
    expect(puts[1].body).toBe(puts[0].body);
    expect(result).toEqual({
      liveUrl: "https://cdn.example.com/map-1/live.json",
      archiveUrl: "https://cdn.example.com/map-1/2026-09-19T20-15-30-123Z.json",
    });
  });

  it("caches the live file for a minute and the archive for good", async () => {
    await uploadSnapshot(snapshot("2026-09-19T20:15:30.123Z"));

    const [archive, live] = puts;
    expect(archive.cacheControl).toBe("public, max-age=31536000, immutable");
    expect(live.cacheControl).toBe("public, max-age=60");
    expect(live.contentType).toBe("application/json; charset=utf-8");
  });
});

describe("pruneArchives", () => {
  it("keeps the five newest archives and never the live file", async () => {
    for (let day = 10; day < 18; day += 1) {
      objects.set(`map-1/2026-09-${day}T00-00-00-000Z.json`, "{}");
    }
    objects.set("map-1/live.json", "{}");
    objects.set("map-2/2026-09-01T00-00-00-000Z.json", "{}");

    await pruneArchives("map-1");

    expect(removed.sort()).toEqual([
      "map-1/2026-09-10T00-00-00-000Z.json",
      "map-1/2026-09-11T00-00-00-000Z.json",
      "map-1/2026-09-12T00-00-00-000Z.json",
    ]);
    expect(objects.has("map-1/live.json")).toBe(true);
    expect(objects.has("map-2/2026-09-01T00-00-00-000Z.json")).toBe(true);
  });
});

describe("deleteSnapshots", () => {
  it("removes everything under the map's prefix and nothing else", async () => {
    objects.set("map-1/live.json", "{}");
    objects.set("map-1/2026-09-19T00-00-00-000Z.json", "{}");
    objects.set("map-10/live.json", "{}");

    await deleteSnapshots("map-1");

    expect([...objects.keys()]).toEqual(["map-10/live.json"]);
  });
});
