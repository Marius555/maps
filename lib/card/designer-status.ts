import { readCardLayout } from "@/lib/validation/card-layout.schema";
import { defaultCardLayout, type CardLayout } from "@/packages/shared/card-layout";

/**
 * Whether the card designer's output is allowed to reach a real card.
 *
 * The designer at /maps/[id]/card is not finished. While it stores a layout that
 * a half-built tool produced, three things read it — the popup on the editor's
 * own canvas, the preview panel, and every published snapshot — so an
 * unfinished tool is not a page somebody has not opened yet, it is what a
 * visitor to a customer's site sees. Every map uses `defaultCardLayout()` until
 * this is true.
 *
 * One flag, in one file, deliberately: turning the designer on again is meant to
 * be a single edit rather than an archaeology exercise across four call sites.
 * Nothing here deletes a saved design — `getCardDesign` still returns it and the
 * designer still loads it — so flipping this restores whatever anyone had.
 */
export const CARD_DESIGNER_ENABLED = false;

/**
 * The layout a card should actually be drawn with.
 *
 * The single seam every reader goes through: components/map/map-canvas-impl.tsx
 * (the live popup), components/preview/embed-preview.tsx (the preview) and
 * lib/repositories/publish.repository.ts (what gets published).
 *
 * With the designer off this returns the default, which
 * `buildSnapshot`'s `cardLayoutField` then omits from the snapshot entirely —
 * so the embed falls back to its *own* `defaultCardLayout()` and the two
 * renderers agree by construction, with nothing added to a published map.
 */
export function effectiveCardLayout(
  stored: Record<string, unknown> | null | undefined,
): CardLayout {
  return CARD_DESIGNER_ENABLED ? readCardLayout(stored ?? {}) : defaultCardLayout();
}
