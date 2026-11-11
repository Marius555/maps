import { SnapScroll } from "./snap-scroll";

/**
 * A marketing page that moves a screen at a time: the landing page and the
 * `/for/*` platform pages.
 *
 * **`mk-snap` is the whole switch.** `html:has(.mk-snap)` in globals.css turns
 * the CSS snap on for the document, and `SnapScroll` reads its stops off this
 * element's children — so every child must be one screen: the first a screen
 * *minus the header* (it shares screen one with it, and is not a stop of its
 * own), every later one a `Section screen`. /pricing, /docs and the legal
 * pages share the shell and do not render this, so they stay documents.
 *
 * `SnapScroll` renders nothing and goes last, so the `:first-child` rule that
 * exempts the first screen from being a stop cannot be affected by it.
 */
export function SnapPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk-snap">
      {children}
      <SnapScroll />
    </div>
  );
}
