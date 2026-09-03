import { readCardLayout } from "@/lib/validation/card-layout.schema";
import type { CardLayout } from "@/packages/shared/card-layout";

/**
 * The layout a card should actually be drawn with.
 *
 * The single seam every reader goes through: components/map/map-canvas-impl.tsx
 * (the live popup), components/preview/embed-preview.tsx (the preview) and
 * lib/repositories/publish.repository.ts (what gets published). One function
 * rather than three calls to `readCardLayout`, so there is one place to change
 * what "the card for this account" means — which is exactly what it was for
 * while the designer was switched off behind a flag here.
 *
 * The stored blob is raw JSON straight off the row, so this has to be the thing
 * that never throws: an account that has never opened the designer stores
 * nothing at all, and `resolveCardLayout({})` answers `defaultCardLayout()` —
 * which `buildSnapshot`'s `cardLayoutField` then omits from the snapshot
 * entirely, so the embed falls back to its *own* copy of that default and the
 * two renderers agree by construction with nothing added to a published map.
 */
export function effectiveCardLayout(
  stored: Record<string, unknown> | null | undefined,
): CardLayout {
  return readCardLayout(stored ?? {});
}
