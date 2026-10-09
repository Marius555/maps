import { addPlace } from "./support/api";
import { expect, test } from "./support/fixtures";

/**
 * The API's answers to people it should refuse. No browser: these are about
 * status codes, and they run in a second or two.
 *
 * `request` is the test account; `secondUser` is somebody else entirely.
 */

/** An id shaped like Appwrite's that no row has. */
const MISSING_ID = "e2enotarealid000000000";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("every account route answers 401, not a page or a 500", async ({ request }) => {
    for (const path of [
      "/api/maps",
      `/api/maps/${MISSING_ID}`,
      `/api/maps/${MISSING_ID}/places`,
      "/api/auth/me",
      "/api/notifications",
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
    }

    const write = await request.post("/api/maps", { data: { name: "e2e-signed-out" } });
    expect(write.status()).toBe(401);
  });
});

test("a map id that does not exist is a 404 on every verb", async ({ request }) => {
  expect((await request.get(`/api/maps/${MISSING_ID}`)).status()).toBe(404);
  expect((await request.patch(`/api/maps/${MISSING_ID}`, { data: { name: "x" } })).status()).toBe(404);
  expect((await request.delete(`/api/maps/${MISSING_ID}`)).status()).toBe(404);
  expect((await request.get(`/api/maps/${MISSING_ID}/places`)).status()).toBe(404);
});

test("bad input is a 422 that names the field", async ({ request, testMap }) => {
  const badPlace = await request.post(`/api/maps/${testMap.id}/places`, {
    data: { name: "E2E Nowhere", lat: 999, lng: 0 },
  });
  expect(badPlace.status()).toBe(422);
  const { error } = (await badPlace.json()) as {
    error: { code: string; fields?: Record<string, string[]> };
  };
  expect(error.code).toBe("validation_failed");
  expect(error.fields?.lat?.[0]).toMatch(/between -90 and 90/);

  const blankName = await request.post("/api/maps", { data: { name: "   " } });
  expect(blankName.status()).toBe(422);

  const notJson = await request.post("/api/maps", {
    headers: { "content-type": "application/json" },
    data: "{not json",
  });
  expect(notJson.status()).toBe(422);
});

test("another account cannot see or touch this account's map", async ({
  request,
  secondUser,
  testMap,
}) => {
  const place = await addPlace(request, testMap.id, {
    name: "E2E Private",
    lat: 54.6872,
    lng: 25.2797,
  });

  // 404 rather than 403 throughout: a stranger learns nothing about which ids exist.
  const map = `/api/maps/${testMap.id}`;
  const attempts = [
    ["GET map", await secondUser.get(map)],
    ["PATCH map", await secondUser.patch(map, { data: { name: "e2e-hijacked" } })],
    ["publish map", await secondUser.post(`${map}/publish`)],
    ["list places", await secondUser.get(`${map}/places`)],
    ["add place", await secondUser.post(`${map}/places`, { data: { name: "x", lat: 1, lng: 1 } })],
    ["GET place", await secondUser.get(`${map}/places/${place.id}`)],
    ["PATCH place", await secondUser.patch(`${map}/places/${place.id}`, { data: { name: "x" } })],
    ["DELETE place", await secondUser.delete(`${map}/places/${place.id}`)],
    ["list shapes", await secondUser.get(`${map}/shapes`)],
    ["DELETE map", await secondUser.delete(map)],
  ] as const;

  for (const [label, response] of attempts) {
    expect(response.status(), label).toBe(404);
  }

  // And nothing moved.
  const after = await request.get(map);
  expect(after.status()).toBe(200);
  const { data } = (await after.json()) as { data: { map: { name: string } } };
  expect(data.map.name).toBe(testMap.name);
  expect((await request.get(`${map}/places/${place.id}`)).status()).toBe(200);

  // Nor does it show up in their list.
  const theirs = (await (await secondUser.get("/api/maps")).json()) as {
    data: { maps: { id: string }[] };
  };
  expect(theirs.data.maps.map((m) => m.id)).not.toContain(testMap.id);
});

test("the billing webhook refuses an unsigned event", async ({ playwright, baseURL }) => {
  // A fresh context with no cookies: the webhook is a machine, not a session.
  const anonymous = await playwright.request.newContext({ baseURL });
  const forged = {
    meta: { event_name: "subscription_created", custom_data: { user_id: "anyone" } },
    data: { type: "subscriptions", id: "1", attributes: { status: "active" } },
  };

  const unsigned = await anonymous.post("/api/webhooks/billing", { data: forged });
  expect(unsigned.status()).toBe(401);

  const badSignature = await anonymous.post("/api/webhooks/billing", {
    data: forged,
    headers: { "x-signature": "0".repeat(64) },
  });
  expect(badSignature.status()).toBe(401);
  await anonymous.dispose();
});

test("the cron routes refuse a caller without the secret", async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL });
  expect((await anonymous.get("/api/cron/sheet-sync")).status()).toBe(401);
  for (const path of ["/api/cron/sheet-sync", "/api/cron/session-retention"]) {
    const post = await anonymous.post(path, {
      data: { mapId: MISSING_ID },
      headers: { authorization: "Bearer wrong" },
    });
    expect(post.status(), `POST ${path}`).toBe(401);
  }
  await anonymous.dispose();
});

test("the visitor beacon says nothing about what it was sent", async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL });
  const beacon = (mapId: string) => ({
    headers: { "content-type": "text/plain" },
    data: JSON.stringify({ v: 1, m: mapId, s: "e2e-session", e: [{ t: "open", o: 0 }] }),
  });

  // A map that doesn't exist is answered exactly like one that does: 204.
  expect((await anonymous.post("/api/collect", beacon(MISSING_ID))).status()).toBe(204);

  // A body it cannot read at all is ours to see, so that one is a 4xx.
  const garbage = await anonymous.post("/api/collect", {
    headers: { "content-type": "text/plain" },
    data: "{not json",
  });
  expect(garbage.status()).toBeGreaterThanOrEqual(400);
  expect(garbage.status()).toBeLessThan(500);

  const wrongContract = await anonymous.post("/api/collect", {
    headers: { "content-type": "text/plain" },
    data: JSON.stringify({ v: 99, m: MISSING_ID, s: "x", e: [{ t: "open", o: 0 }] }),
  });
  expect(wrongContract.status()).toBe(422);
  await anonymous.dispose();
});
