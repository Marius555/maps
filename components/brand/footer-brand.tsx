import Link from "next/link";

import { BRAND } from "@/lib/brand";

import { BrandLogo } from "./brand-logo";
import { CompanyDetails } from "./company-details";

/** The footer's first column: the mark, the tagline, and who runs the product. */
export function FooterBrand() {
  return (
    <div className="flex max-w-xs flex-col gap-4">
      <Link
        href="/"
        aria-label="Home"
        className="w-fit rounded-sm text-foreground transition-opacity hover:opacity-70"
      >
        <BrandLogo className="h-5" />
      </Link>

      {BRAND.tagline ? <p>{BRAND.tagline}</p> : null}

      <CompanyDetails />
    </div>
  );
}
