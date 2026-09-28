import type { MapTagGroup } from "@/lib/repositories/types";

/**
 * The draft, plus every tag the map gained while the dialog was open.
 *
 * The dialog stays open under Edit location, whose tag picker can create a tag
 * (tag-quick-add.tsx) — which PATCHes `tagGroups` whole. Saving this draft as it
 * stood would then delete that tag again. So a tag on the live map that was
 * neither there when the dialog opened nor is in the draft is new, and it is
 * put back into its own group (or the first one, if the draft has lost that
 * group). A tag the owner removed here was there on opening, so it stays gone.
 */
export function withTagsAddedSince(
  draft: readonly MapTagGroup[],
  opened: readonly MapTagGroup[],
  live: readonly MapTagGroup[],
): MapTagGroup[] {
  const known = new Set(
    [...opened, ...draft].flatMap((group) => group.tags.map((tag) => tag.id)),
  );
  const next = draft.map((group) => ({ ...group, tags: [...group.tags] }));

  for (const group of live) {
    for (const tag of group.tags) {
      if (known.has(tag.id)) continue;

      const home = next.find((candidate) => candidate.id === group.id) ?? next[0];
      if (home) home.tags.push(tag);
      else next.push({ ...group, tags: [tag] });
    }
  }

  return next;
}
