import { BRAND } from "@/lib/brand";
import { INTEGRATIONS } from "@/lib/marketing/integrations";

import { BrandLink } from "./brand-link";

type FooterLink = { label: string; href: string };

/** Drops the entries brand.json has no link for: an empty string means "not set". */
function present(links: { label: string; href: string | undefined }[]) {
  return links.filter((link): link is FooterLink => Boolean(link.href));
}

/**
 * The footer's columns: the navbar's links, the Integrations menu written out
 * one link per platform (a footer has the room a navbar does not), and the
 * legal and social links brand.json has a value for.
 *
 * Social profiles are words rather than logos: lucide is withdrawing its brand
 * glyphs, and a column of named links needs no icon to be understood.
 */
const COLUMNS: readonly { title: string; links: readonly FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Documentation", href: "/docs" },
      { label: "News", href: "/news" },
    ],
  },
  {
    title: "Integrations",
    links: INTEGRATIONS.map(({ name, href }) => ({ label: name, href })),
  },
  {
    title: "Legal",
    links: present([
      { label: "Terms", href: BRAND.legal.termsUrl },
      { label: "Privacy", href: BRAND.legal.privacyUrl },
      { label: "Cookies", href: BRAND.legal.cookiesUrl },
      { label: "Refunds", href: BRAND.legal.refundsUrl },
    ]),
  },
  {
    title: "Follow",
    links: present([
      { label: "X", href: BRAND.social.x },
      { label: "LinkedIn", href: BRAND.social.linkedin },
      { label: "Facebook", href: BRAND.social.facebook },
      { label: "Instagram", href: BRAND.social.instagram },
      { label: "GitHub", href: BRAND.social.github },
    ]),
  },
].filter((column) => column.links.length > 0);

/** Two columns on a phone, all of them in one row from `sm`. */
export function FooterNav() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
      {COLUMNS.map(({ title, links }) => (
        <nav key={title} aria-label={title}>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <ul className="mt-3 space-y-2">
            {links.map(({ label, href }) => (
              <li key={href}>
                <BrandLink
                  href={href}
                  className="rounded-sm transition-colors hover:text-foreground"
                >
                  {label}
                </BrandLink>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
}
