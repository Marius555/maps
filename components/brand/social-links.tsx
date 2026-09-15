import { BRAND } from "@/lib/brand";
import { BrandLink } from "./brand-link";

const SOCIAL = [
  { label: "X", href: BRAND.social.x },
  { label: "LinkedIn", href: BRAND.social.linkedin },
  { label: "Facebook", href: BRAND.social.facebook },
  { label: "Instagram", href: BRAND.social.instagram },
  { label: "GitHub", href: BRAND.social.github },
].filter((item): item is { label: string; href: string } => Boolean(item.href));

/**
 * The social profiles brand.json has a link for, as words.
 *
 * Words rather than logos: lucide is withdrawing its brand glyphs, and a row of
 * five named links needs no icon to be understood.
 */
export function SocialLinks({ className = "" }: { className?: string }) {
  if (SOCIAL.length === 0) return null;

  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
      {SOCIAL.map(({ label, href }) => (
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
