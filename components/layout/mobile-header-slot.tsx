"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * A place for a page to put its own control **in the mobile header**, beside the
 * hamburger.
 *
 * Below `md` the app has exactly one horizontal band of chrome, and everything
 * that opens something lives in it — the nav drawer's trigger is there and a
 * page-level panel's trigger belongs on the same line, at the other end. The
 * alternative is a second bar inside the page, which is the thing the header's
 * own docblock says it exists to avoid.
 *
 * **A portal rather than a prop**, because the header is rendered by the
 * dashboard layout and the page is rendered by `children` several levels below
 * it. Portals keep React context, so the button is still inside the page's own
 * providers and reads that page's state normally.
 *
 * The slot is **not** conditionally rendered: `MobileHeader` is `md:hidden`, so
 * whatever goes in here disappears at `md` in CSS, with no media query and no
 * first-paint flash. A trigger mounted but hidden cannot be pressed.
 *
 * **Nothing uses it today, and that is a fact worth recording rather than a
 * reason to delete it.** The card designer's panel trigger was its one user, and
 * that panel is a bottom sheet now — a grab rail along the bottom of the frame
 * is its own trigger at every width, so a second way in at the far end of the
 * header was a control for a thing already on screen. The mechanism is the
 * answer for the next page with exactly one thing to open, and the argument for
 * it (a second horizontal band is what the header exists to avoid) has not
 * changed.
 */
const MobileHeaderSlotContext = createContext<{
  node: HTMLElement | null;
  setNode: (node: HTMLElement | null) => void;
}>({ node: null, setNode: () => undefined });

export function MobileHeaderSlotProvider({
  children,
}: {
  children: ReactNode;
}) {
  /*
   * State and not a ref: the page renders in the same pass as the header, so a
   * ref would still be null when the portal first wants it and nothing would
   * re-render to correct that. Setting state from the ref callback costs one
   * extra render on mount and is what makes the portal land at all.
   */
  const [node, setNode] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ node, setNode }), [node]);

  return (
    <MobileHeaderSlotContext.Provider value={value}>
      {children}
    </MobileHeaderSlotContext.Provider>
  );
}

/** The header's end of it. Rendered once, by `MobileHeader`. */
export function MobileHeaderSlot() {
  const { setNode } = useContext(MobileHeaderSlotContext);

  // `ms-auto` is what pushes it to the far end of the row — the trigger sits
  // opposite the hamburger rather than beside the product name.
  return <div ref={setNode} className="ms-auto flex items-center gap-1" />;
}

/** A page's end of it. Renders nothing until the header has mounted. */
export function MobileHeaderActions({ children }: { children: ReactNode }) {
  const { node } = useContext(MobileHeaderSlotContext);

  return node ? createPortal(children, node) : null;
}
