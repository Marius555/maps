import { BRAND } from "@/lib/brand";

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
export function publishBadge(): { brand: string; url: string } | undefined {
  if (!BRAND.website) return undefined;

  const url = new URL(BRAND.website);
  url.searchParams.set("ref", "embed");

  return { brand: BRAND.name, url: url.toString() };
}
