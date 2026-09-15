import Link from "next/link";

import { isExternalLink } from "@/lib/brand";

/**
 * A link from brand.json, which may point at our own origin or somebody else's.
 *
 * A path goes through the router like any other in-app link. A full address
 * opens in a new tab: a Terms page on another site is something to read and
 * close, and following it in place would drop whatever form the reader was
 * halfway through — the consent notice sits under the signup form.
 */
export function BrandLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (isExternalLink(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
