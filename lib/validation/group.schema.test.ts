import { describe, expect, it } from "vitest";

import {
  DEFAULT_GROUP_COLOR,
  createGroupSchema,
  groupIdSchema,
  updateGroupSchema,
} from "./group.schema";

describe("createGroupSchema", () => {
  it("fills in the colour and order a gesture does not supply", () => {
    const parsed = createGroupSchema.parse({ name: "North region" });

    expect(parsed).toEqual({
      name: "North region",
      color: DEFAULT_GROUP_COLOR,
      sortOrder: 0,
    });
  });

  it("trims the name and refuses an empty one", () => {
    expect(createGroupSchema.parse({ name: "  Depots  " }).name).toBe("Depots");
    expect(createGroupSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("updateGroupSchema", () => {
  it("takes one field at a time, which is what a rename sends", () => {
    expect(updateGroupSchema.parse({ name: "Depots" })).toEqual({
      name: "Depots",
    });
  });

  it("refuses an empty patch", () => {
    expect(updateGroupSchema.safeParse({}).success).toBe(false);
  });
});

describe("groupIdSchema", () => {
  it("accepts the empty string, which is how a member says 'ungrouped'", () => {
    expect(groupIdSchema.parse("")).toBe("");
  });

  it("accepts an Appwrite id", () => {
    expect(groupIdSchema.parse("68f0a1b2c3d4e5f60718")).toBe(
      "68f0a1b2c3d4e5f60718",
    );
  });

  it("refuses something that is not an id", () => {
    expect(groupIdSchema.safeParse("../../maps").success).toBe(false);
    expect(groupIdSchema.safeParse("a".repeat(37)).success).toBe(false);
  });
});
