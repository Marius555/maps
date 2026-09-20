import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MapSnapshot } from "@/packages/shared/snapshot";

/**
 * `SNAPSHOT_PUBLIC_URL` is the switch between the two stores. Unset must mean
 * exactly what it meant before R2 existed, and deleting a map must clear both —
 * a map published before the move still has its Appwrite copies.
 */

const env = vi.hoisted(() => ({ snapshotPublicUrl: "" }));
vi.mock("@/lib/env", () => ({ env }));

const appwrite = vi.hoisted(() => ({ uploadSnapshot: vi.fn(), deleteSnapshots: vi.fn() }));
const r2 = vi.hoisted(() => ({ uploadSnapshot: vi.fn(), deleteSnapshots: vi.fn() }));
vi.mock("./appwrite-store", () => appwrite);
vi.mock("./r2-store", () => r2);

import { deleteSnapshots, uploadSnapshot } from "./storage";

const SNAPSHOT = { version: 1, mapId: "map-1" } as MapSnapshot;

beforeEach(() => {
  vi.clearAllMocks();
  env.snapshotPublicUrl = "";
});

describe("uploadSnapshot", () => {
  it("goes to Appwrite when SNAPSHOT_PUBLIC_URL is unset", async () => {
    await uploadSnapshot(SNAPSHOT);

    expect(appwrite.uploadSnapshot).toHaveBeenCalledWith(SNAPSHOT);
    expect(r2.uploadSnapshot).not.toHaveBeenCalled();
  });

  it("goes to R2 when it is set", async () => {
    env.snapshotPublicUrl = "https://cdn.example.com";

    await uploadSnapshot(SNAPSHOT);

    expect(r2.uploadSnapshot).toHaveBeenCalledWith(SNAPSHOT);
    expect(appwrite.uploadSnapshot).not.toHaveBeenCalled();
  });
});

describe("deleteSnapshots", () => {
  it("clears R2 and the Appwrite leftovers when on R2", async () => {
    env.snapshotPublicUrl = "https://cdn.example.com";

    await deleteSnapshots("map-1");

    expect(r2.deleteSnapshots).toHaveBeenCalledWith("map-1");
    expect(appwrite.deleteSnapshots).toHaveBeenCalledWith("map-1");
  });

  it("stops before Appwrite if R2 fails, so the map delete stops too", async () => {
    env.snapshotPublicUrl = "https://cdn.example.com";
    r2.deleteSnapshots.mockRejectedValueOnce(new Error("R2 down"));

    await expect(deleteSnapshots("map-1")).rejects.toThrow("R2 down");
  });

  it("touches only Appwrite when unset", async () => {
    await deleteSnapshots("map-1");

    expect(r2.deleteSnapshots).not.toHaveBeenCalled();
    expect(appwrite.deleteSnapshots).toHaveBeenCalledWith("map-1");
  });
});
