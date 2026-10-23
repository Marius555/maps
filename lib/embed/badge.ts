import { BRAND } from "@/lib/brand";

/**
 * The brand mark drawn beside the name, as the SVG `public/logo/pinglide-mark.svg`
 * holds minus its `<title>` and `role` — an `<img>` is `alt=""` here, because the
 * link carries the words. `badge.test.ts` keeps the two in step.
 *
 * Inline, and shipped in the snapshot as a data URI, rather than linked: the
 * file lives on the dashboard's host, and a free map loaded on a customer's page
 * would fetch it from there on every view (§2). An SVG in an `<img>` runs no
 * script, so a data URI is as safe as a file.
 */
export const BADGE_MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="21 5 70 96"><path fill="none" stroke="#181818" stroke-width="12" stroke-linecap="round" d="M82 40A26 26 0 1 1 56 14M30 40V92"/><circle cx="74.38" cy="21.62" r="9" fill="#F54600"/></svg>';

/** What a publish needs to draw the badge. See `MapSnapshot.badge`. */
export type PublishBadge = { brand: string; url: string; logo?: string };

/**
 * Where the "Made with" badge on a free map points, and whose name it says.
 *
 * `undefined` when brand.json has no website — a badge linking nowhere is an
 * advert for nothing, so it is simply not drawn. `?ref=embed` so the visits it
 * sends can be told apart from everything else arriving at the site.
 *
 * Whether a map shows it is the plan's question (`PLAN_FEATURES.noBadge`),
 * answered by the caller: the publish repository for a real publish, and the
 * publish page for the preview, so the owner sees the badge before a visitor
 * does.
 */
export function publishBadge(): PublishBadge | undefined {
  if (!BRAND.website) return undefined;

  const url = new URL(BRAND.website);
  url.searchParams.set("ref", "embed");

  return {
    brand: BRAND.name,
    url: url.toString(),
    logo: `data:image/svg+xml,${encodeURIComponent(BADGE_MARK)}`,
  };
}
