import { BRAND } from "@/lib/brand";
import { BrandLink } from "./brand-link";

const LEGAL = [
  { label: "Terms", href: BRAND.legal.termsUrl },
  { label: "Privacy", href: BRAND.legal.privacyUrl },
  { label: "Cookies", href: BRAND.legal.cookiesUrl },
].filter((item): item is { label: string; href: string } => Boolean(item.href));

/** Whichever of Terms, Privacy and Cookies brand.json has a link for. */
export function LegalLinks({ className = "" }: { className?: string }) {
  if (LEGAL.length === 0) return null;

  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
      {LEGAL.map(({ label, href }) => (
        <li key={label}>
          <BrandLink
            href={href}
            className="transition-colors hover:text-foreground"
          >
            {label}
          </BrandLink>
        </li>
      ))}
    </ul>
  );
}
