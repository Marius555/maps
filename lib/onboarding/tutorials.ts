/**
 * The onboarding overlays, by id. A plain module because both halves need the
 * list: the server to find each one's "seen" stamp, the client to name which
 * one it is closing.
 *
 * - `maps`: the maps list, pointing at Create map.
 * - `editor`: an empty map's editor, pointing at the pin button and Locations.
 * - `card`: the editor once the map has a location, pointing at Card.
 * - `publish`: wherever the owner lands on leaving the card designer, pointing
 *   at Publish.
 */
export const TUTORIAL_IDS = ["maps", "editor", "card", "publish"] as const;

export type TutorialId = (typeof TUTORIAL_IDS)[number];

export function isTutorialId(value: string): value is TutorialId {
  return (TUTORIAL_IDS as readonly string[]).includes(value);
}
