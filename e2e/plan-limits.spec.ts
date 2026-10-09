import type { APIRequestContext } from "@playwright/test";
import { createMap, deleteMap, listMaps, uniqueMapName, type NewPlace } from "./support/api";
import { PLANS_DISABLED } from "./support/env";
import { expect, test } from "./support/fixtures";

/**
 * Plan limits, enforced by the repositories (CLAUDE.md §6) — so asked of the
 * API directly, the way someone skipping the UI would.
 *
 * On the **second** account: the main one has to be on Pro (or the whole run
 * under `DISABLE_ALL_PLAN`), because every other spec makes maps in parallel and
 * Free allows one. Whatever plan the second account is on, its map ceiling is
 * found by walking up to it; the places check needs it on Free.
 *
 * Meaningless while `DISABLE_ALL_PLAN` is on, which reads every account as Pro
 * and lifts every limit. e2e/README.md has the second pass that runs these.
 */
test.skip(PLANS_DISABLED, "DISABLE_ALL_PLAN is on, so no limit can be reached — see e2e/README.md");
test.describe.configure({ mode: "serial" });

/** Matches PLAN_LIMITS in lib/limits/plans.ts. */
const MAP_LIMITS = { free: 1, starter: 3, pro: 15 } as const;
const FREE_PLACES = 25;

let planOfSecondAccount: keyof typeof MAP_LIMITS | undefined;

async function ownedMapCount(request: APIRequestContext): Promise<number> {
  return (await listMaps(request)).length;
}

test("the map after the plan's last is refused with a limit message", async ({ secondUser }) => {
  const made: string[] = [];
  try {
    let refusal: { status: number; code: string; message: string } | undefined;

    // Pro's ceiling is 15; one past it is the most this can ever take.
    for (let i = 0; i <= MAP_LIMITS.pro && !refusal; i++) {
      const response = await secondUser.post("/api/maps", {
        data: { name: uniqueMapName("limit") },
      });
      if (response.status() === 201) {
        const { data } = (await response.json()) as { data: { map: { id: string } } };
        made.push(data.map.id);
      } else {
        const { error } = (await response.json()) as { error: { code: string; message: string } };
        refusal = { status: response.status(), ...error };
      }
    }

    expect(refusal, "no map was ever refused").toBeDefined();
    expect(refusal!.status).toBe(403);
    expect(refusal!.code).toBe("plan_limit_reached");
    expect(refusal!.message).not.toBe("");

    const ceiling = await ownedMapCount(secondUser);
    const plan = (Object.keys(MAP_LIMITS) as (keyof typeof MAP_LIMITS)[]).find(
      (name) => MAP_LIMITS[name] === ceiling,
    );
    expect(plan, `refused at ${ceiling} maps, which is no plan's limit`).toBeDefined();
    planOfSecondAccount = plan;
  } finally {
    for (const id of made) await deleteMap(secondUser, id);
  }
});

test("the location after Free's last is refused, singly and in bulk", async ({ secondUser }) => {
  test.skip(planOfSecondAccount !== "free", "The second account isn't on Free");

  // Free allows one map, so the account must hold none before this makes one.
  test.skip(
    (await ownedMapCount(secondUser)) > 0,
    "The second account already owns a map; Free allows one",
  );

  const map = await createMap(secondUser, uniqueMapName("limit-places"));
  try {
    const row = (i: number): NewPlace => ({ name: `E2E Limit ${i}`, lat: 54 + i / 100, lng: 25 });

    // One too many in a single import is refused whole, not cut short.
    const tooMany = await secondUser.post(`/api/maps/${map.id}/places/bulk`, {
      data: { places: Array.from({ length: FREE_PLACES + 1 }, (_, i) => row(i)) },
    });
    expect(tooMany.status()).toBe(403);
    expect((await secondUser.get(`/api/maps/${map.id}/places`)).ok()).toBe(true);

    const exactly = await secondUser.post(`/api/maps/${map.id}/places/bulk`, {
      data: { places: Array.from({ length: FREE_PLACES }, (_, i) => row(i)) },
    });
    expect(exactly.status(), await exactly.text()).toBe(201);

    const oneMore = await secondUser.post(`/api/maps/${map.id}/places`, { data: row(99) });
    expect(oneMore.status()).toBe(403);
    const { error } = (await oneMore.json()) as { error: { code: string } };
    expect(error.code).toBe("plan_limit_reached");
  } finally {
    await deleteMap(secondUser, map.id);
  }
});
