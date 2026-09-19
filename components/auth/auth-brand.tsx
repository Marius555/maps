import { MapPin } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { BRAND } from "@/lib/brand";

/**
 * The product's mark and name, in the form column's top corner, level with the
 * back arrow — on every width, so the form half of the screen says whose it is
 * on its own rather than leaning on the panel beside it.
 *
 * **The mark is a placeholder until brand.json has a logo.** A pin on the
 * accent, beside the name. Setting `logo.light` swaps both for `BrandLogo`'s
 * image, which is how every other spot in the app treats a logo: it is the
 * wordmark, not an icon to put the name beside.
 */
export function AuthBrand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-md text-foreground transition-opacity hover:opacity-70"
    >
      {BRAND.logo.light ? (
        <BrandLogo className="h-7" />
      ) : (
        <>
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-lg bg-accent text-accent-foreground"
          >
            <MapPin className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">{BRAND.name}</span>
        </>
      )}
    </Link>
  );
}
