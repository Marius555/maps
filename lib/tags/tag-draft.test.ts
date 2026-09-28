import { describe, expect, it } from "vitest";

import type { MapTagGroup } from "@/lib/repositories/types";
import { withTagsAddedSince } from "./tag-draft";

const tag = (id: string) => ({ id, label: id, color: "#e03131" });
const group = (id: string, ...ids: string[]): MapTagGroup => ({
  id,
  label: id,
  tags: ids.map(tag),
});

describe("withTagsAddedSince", () => {
  it("puts back a tag created elsewhere while the dialog was open", () => {
    const opened = [group("g1", "a")];
    const draft = [group("g1", "a")];
    const live = [group("g1", "a", "new")];

    expect(withTagsAddedSince(draft, opened, live)[0].tags.map((t) => t.id)).toEqual([
      "a",
      "new",
    ]);
  });

  it("keeps a tag the owner removed in the draft removed", () => {
    const opened = [group("g1", "a", "b")];
    const draft = [group("g1", "a")];
    const live = [group("g1", "a", "b")];

    expect(withTagsAddedSince(draft, opened, live)[0].tags.map((t) => t.id)).toEqual([
      "a",
    ]);
  });

  it("falls back to the first group when the new tag's group is gone", () => {
    const opened = [group("g1", "a"), group("g2")];
    const draft = [group("g1", "a")];
    const live = [group("g1", "a"), group("g2", "new")];

    const next = withTagsAddedSince(draft, opened, live);
    expect(next).toHaveLength(1);
    expect(next[0].tags.map((t) => t.id)).toEqual(["a", "new"]);
  });

  it("creates the group when the draft has none at all", () => {
    const live = [group("g1", "new")];

    expect(withTagsAddedSince([], [], live)).toEqual(live);
  });

  it("does not mutate the draft", () => {
    const draft = [group("g1", "a")];
    withTagsAddedSince(draft, [group("g1", "a")], [group("g1", "a", "new")]);

    expect(draft[0].tags).toHaveLength(1);
  });
});
