import { BRAND } from "@/lib/brand";

/**
 * The product's mark, wherever its name is drawn: the logo from brand.json when
 * one is set, the name as plain text when not.
 *
 * The text fallback carries no styling of its own, so each spot keeps the type
 * it already had — the sidebar's link, the drawer's heading and the auth panel
 * all style the name from outside, and that has to keep working the day nobody
 * has set a logo.
 *
 * `className` sizes the image by height; the width follows the file's own
 * proportions.
 *
 * **A plain `<img>`, not `next/image`.** The logo is whatever URL gets pasted
 * into brand.json, and `next/image` refuses a remote host until it is listed in
 * `images.remotePatterns` — so every new logo host would be a second edit in
 * next.config.ts, which is exactly what one file was meant to remove.
 *
 * With a dark variant, both images are rendered and CSS shows one. Both carry
 * the alt text: `display: none` takes an element out of the accessibility tree,
 * so only the visible one is announced.
 */
export function BrandLogo({ className = "h-6" }: { className?: string }) {
  const { light, dark, alt } = BRAND.logo;

  if (!light) return <>{BRAND.name}</>;

  const size = `${className} w-auto max-w-full object-contain object-left`;
  const label = alt ?? BRAND.name;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote logo host, see above */}
      <img
        src={light}
        alt={label}
        className={`${size} ${dark ? "block dark:hidden" : "block"}`}
      />
      {dark ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote logo host, see above
        <img src={dark} alt={label} className={`${size} hidden dark:block`} />
      ) : null}
    </>
  );
}
