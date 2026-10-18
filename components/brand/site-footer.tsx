import { FooterBrand } from "./footer-brand";
import { FooterNav } from "./footer-nav";

/**
 * The marketing pages' footer: one band, with no rule inside it.
 *
 * The mark, tagline, contact and © on the left; the link columns on the right.
 * Below `lg` the brand block sits above the columns, which go two-up on a
 * phone and four-up from `sm`. Everything is one type size, so no part of it
 * reads as a second strip of small print.
 *
 * Kept short on purpose: on the landing page the footer is a snap point
 * aligned to `end` (globals.css), and a footer anywhere near a screen tall
 * would be a screen of its own.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      {/* The same measure and gutter as `SiteHeader`, so the public site has
          one column rather than a header on one and a footer on another. */}
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 text-sm text-muted sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <FooterBrand />
        <FooterNav />
      </div>
    </footer>
  );
}
