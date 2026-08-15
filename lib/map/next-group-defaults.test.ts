import { describe, expect, it } from "vitest";

import { CATEGORY_COLORS } from "@/lib/validation/category.schema";
import { nextGroupDefaults } from "./next-group-defaults";

describe("nextGroupDefaults", () => {
  it("starts at Group 1 on a map with none", () => {
    expect(nextGroupDefaults([]).name).toBe("Group 1");
  });

  it("counts on from the highest number in use", () => {
    const groups = [
      { name: "Group 1", sortOrder: 0 },
      { name: "Group 2", sortOrder: 1 },
    ];

    expect(nextGroupDefaults(groups).name).toBe("Group 3");
  });

  it("does not reuse a number freed by a delete", () => {
    // "Group 2" is gone. Counting by length alone would hand out "Group 3"
    // twice; counting from the highest in use gives a fresh one.
    const groups = [
      { name: "Group 1", sortOrder: 0 },
      { name: "Group 3", sortOrder: 2 },
    ];

    expect(nextGroupDefaults(groups).name).toBe("Group 4");
  });

  it("ignores names the user chose", () => {
    const groups = [
      { name: "North region", sortOrder: 0 },
      { name: "Group 1", sortOrder: 1 },
    ];

    expect(nextGroupDefaults(groups).name).toBe("Group 2");
  });

  it("puts the new group after every existing one", () => {
    const groups = [
      { name: "North region", sortOrder: 7 },
      { name: "Group 1", sortOrder: 2 },
    ];

    expect(nextGroupDefaults(groups).sortOrder).toBe(8);
  });

  it("gives consecutive groups different colours", () => {
    const first = nextGroupDefaults([]);
    const second = nextGroupDefaults([
      { name: first.name, sortOrder: 0, color: first.color },
    ]);

    expect(second.color).not.toBe(first.color);
  });

  it("avoids a colour already in use, however many groups there are", () => {
    // Counting by length would hand out index 1 here and collide with the group
    // that already has it. A group's colour is painted onto its members now, so
    // two groups sharing one says they are the same group.
    const groups = [{ name: "Group 1", sortOrder: 0, color: "#d6336c" }];

    expect(nextGroupDefaults(groups).color).not.toBe("#d6336c");
  });

  it("still returns a colour once the palette is used up", () => {
    const groups = CATEGORY_COLORS.map((color, index) => ({
      name: `Group ${index + 1}`,
      sortOrder: index,
      color,
    }));

    expect(CATEGORY_COLORS).toContain(nextGroupDefaults(groups).color);
  });
});
