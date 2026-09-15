import { CompanyDetails } from "./company-details";
import { LegalLinks } from "./legal-links";
import { SocialLinks } from "./social-links";

/**
 * The marketing pages' footer, built entirely from brand.json.
 *
 * One column on a phone, two from `sm`: the company on the left, the links on
 * the right and right-aligned, so the two blocks read as the page's two edges.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
        <CompanyDetails />

        <div className="space-y-2 sm:text-right">
          <LegalLinks className="sm:justify-end" />
          <SocialLinks className="sm:justify-end" />
        </div>
      </div>
    </footer>
  );
}
