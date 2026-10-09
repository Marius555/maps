import { expect, type APIRequestContext } from "@playwright/test";
import { E2E_PREFIX } from "./paths";

/**
 * Setup and teardown through the dashboard's own REST routes, using the
 * signed-in context's session cookie. Faster than clicking, and it keeps each
 * spec about the one flow it is testing.
 *
 * Every route answers `{ data: … }` (lib/api/responses.ts).
 */

export type TestMap = { id: string; name: string };

export type TestPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  tags: string[];
};

export type NewPlace = {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  tags?: string[];
  phone?: string;
};

export type Snapshot = {
  places: { id: string; name: string; tags?: string[]; phone?: string }[];
  shapes?: { id: string; kind: string }[];
  settings?: Record<string, unknown>;
  allowedDomains?: string[];
};

export function uniqueMapName(label: string): string {
  return `${E2E_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function createMap(
  request: APIRequestContext,
  name: string,
): Promise<TestMap> {
  const response = await request.post("/api/maps", { data: { name } });
  expect(response.status(), await response.text()).toBe(201);
  const { data } = (await response.json()) as { data: { map: TestMap } };
  return { id: data.map.id, name: data.map.name };
}

/** PATCH the map: `tagGroups`, `settings`, `allowedDomains`, … (updateMapSchema). */
export async function updateMap(
  request: APIRequestContext,
  mapId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const response = await request.patch(`/api/maps/${mapId}`, { data: patch });
  expect(response.status(), await response.text()).toBe(200);
}

export async function addPlace(
  request: APIRequestContext,
  mapId: string,
  place: NewPlace,
): Promise<TestPlace> {
  const response = await request.post(`/api/maps/${mapId}/places`, {
    data: place,
  });
  expect(response.status(), await response.text()).toBe(201);
  const { data } = (await response.json()) as { data: { place: TestPlace } };
  return data.place;
}

/** The import's confirm step: up to 200 at once, limits enforced server-side. */
export async function addPlaces(
  request: APIRequestContext,
  mapId: string,
  places: NewPlace[],
): Promise<void> {
  const response = await request.post(`/api/maps/${mapId}/places/bulk`, {
    data: { places },
  });
  expect(response.status(), await response.text()).toBe(201);
}

export async function listPlaces(
  request: APIRequestContext,
  mapId: string,
): Promise<TestPlace[]> {
  const response = await request.get(`/api/maps/${mapId}/places?limit=100`);
  expect(response.ok(), await response.text()).toBe(true);
  const { data } = (await response.json()) as { data: { places: TestPlace[] } };
  return data.places;
}

export async function updatePlace(
  request: APIRequestContext,
  mapId: string,
  placeId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const response = await request.patch(`/api/maps/${mapId}/places/${placeId}`, { data: patch });
  expect(response.status(), await response.text()).toBe(200);
}

export type TestShape = {
  id: string;
  name: string;
  /** The kind lives inside the geometry (packages/shared/shapes.ts). */
  geometry: { kind: "circle" | "polygon" | "line" } & Record<string, unknown>;
};

export async function listShapes(
  request: APIRequestContext,
  mapId: string,
): Promise<TestShape[]> {
  const response = await request.get(`/api/maps/${mapId}/shapes`);
  expect(response.ok(), await response.text()).toBe(true);
  const { data } = (await response.json()) as { data: { shapes: TestShape[] } };
  return data.shapes;
}

/**
 * Publishes and returns the **live** snapshot URL — the one a snippet carries,
 * stable across republishes. Publishing is limited to 20 per 10 minutes per
 * account (lib/limits/rate.ts), so specs share a published map where they can.
 */
export async function publishMap(
  request: APIRequestContext,
  mapId: string,
): Promise<string> {
  const response = await request.post(`/api/maps/${mapId}/publish`);
  expect(response.status(), await response.text()).toBe(200);
  const { data } = (await response.json()) as { data: { map: { snapshotUrl: string } } };
  expect(data.map.snapshotUrl).toBeTruthy();
  return data.map.snapshotUrl;
}

/**
 * Reads a published snapshot past every cache.
 *
 * `live.json` is served `max-age=60` and Cloudflare's edge honours it
 * (lib/snapshot/r2-store.ts), so straight after a republish the plain URL can
 * still answer with the previous file — by design, and not what a test of the
 * publish means to read. A query string is part of the edge's cache key.
 */
export async function readSnapshot(
  request: APIRequestContext,
  snapshotUrl: string,
): Promise<Snapshot> {
  const bust = `${snapshotUrl.includes("?") ? "&" : "?"}e2e=${Date.now()}`;
  const response = await request.get(`${snapshotUrl}${bust}`, {
    headers: { "cache-control": "no-cache" },
  });
  expect(response.ok(), `snapshot ${snapshotUrl}: ${response.status()}`).toBe(true);
  return (await response.json()) as Snapshot;
}

/** The harness page that runs the real bundle against a snapshot (lib/embed/snippet.ts). */
export function embedTestPage(snapshotUrl: string, tags: string[] = []): string {
  const tagParam = tags.length > 0 ? `tags=${encodeURIComponent(tags.join(","))}&` : "";
  return `/embed/live.html?${tagParam}snapshot=${encodeURIComponent(snapshotUrl)}`;
}

export async function listMaps(request: APIRequestContext): Promise<TestMap[]> {
  const response = await request.get("/api/maps");
  expect(response.ok(), await response.text()).toBe(true);
  const { data } = (await response.json()) as { data: { maps: TestMap[] } };
  return data.maps;
}

/** Tolerates a map already gone: the test itself may have deleted it. */
export async function deleteMap(
  request: APIRequestContext,
  id: string,
): Promise<void> {
  const response = await request.delete(`/api/maps/${id}`);
  expect([204, 404]).toContain(response.status());
}
