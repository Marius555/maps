import { readCardLayout } from "@/lib/validation/card-layout.schema";
import { isSavedCardLayout, type CardLayout } from "@/packages/shared/card-layout";

import { starterCardLayout } from "./starter-layout";

/**
 * The layout a card should actually be drawn with.
 *
 * The single seam every reader goes through: components/map/map-canvas-impl.tsx
 * (the live popup), components/preview/embed-preview.tsx (the preview) and
 * lib/repositories/publish.repository.ts (what gets published). One function
 * rather than three calls to `readCardLayout`, so there is one place to change
 * what "the card for this account" means.
 *
 * An account that has never saved a design draws `starterCardLayout()` — and
 * publishes it explicitly, because it is not the embed's own default
 * (lib/card/starter-layout.ts says why that default must stay as it is). A
 * design somebody *saved*, including one they cleared to three empty zones,
 * is read as stored: `isSavedCardLayout` is what tells the two apart, the same
 * check the designer opens with.
 *
 * The stored blob is raw JSON straight off the row, so this has to be the thing
 * that never throws — `readCardLayout` degrades anything to something drawable.
 */
export function effectiveCardLayout(
  stored: Record<string, unknown> | null | undefined,
): CardLayout {
  return isSavedCardLayout(stored) ? readCardLayout(stored ?? {}) : starterCardLayout();
}
