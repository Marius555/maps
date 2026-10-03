"use client";

import { createContext, useContext } from "react";

/**
 * How a card's photo opens the full-screen lightbox, where one may open at all.
 *
 * A context rather than a prop through `CardView` → `CardBlockContent` →
 * `Gallery`, because exactly one host provides it: the editor map's place card
 * (components/map/place-card/place-card.tsx). The designer canvas and its drag
 * preview leave it unset, so a press on the photo there still selects or picks
 * up the block, which is what that canvas is for.
 */
export const GalleryLightboxContext = createContext<((photos: string[]) => void) | null>(null);

export function useGalleryLightbox(): ((photos: string[]) => void) | null {
  return useContext(GalleryLightboxContext);
}
