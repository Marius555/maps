import type { Metadata } from "next";
import Link from "next/link";

import { UsageGrid } from "@/components/account/usage-grid";
import { SettingsSection } from "@/components/user-settings/section/settings-section";
import { requireUser } from "@/lib/auth/current-user";
import { repoContext } from "@/lib/repositories/context";
import { listMapSummaries } from "@/lib/repositories/map-summary.repository";
import { getUserPlan } from "@/lib/repositories/plan-limits";
import { getLookupUsage } from "@/lib/repositories/usage.repository";

export const metadata: Metadata = { title: "Usage" };

/**
 * Everything this account has a ceiling on, measured against the plan.
 *
 * It was the top half of the old account page, and has a page of its own now,
 * the way claude.ai separates Usage from Billing: "how much am I using?" and
 * "what am I paying?" are asked at different times.
 *
 * `listMapSummaries` rather than a count query per table: it is already
 * owner-scoped through `listMaps`, already returns the two counts, and is
 * exactly what `/maps` fetches on every visit. It costs three reads per map, one
 * of which (groups) this page does not use — accepted, because the alternative
 * is a second near-identical repository function to save one request on a page
 * nobody sits on. If it ever measures slow, that function is the fix.
 */
export default async function UsageSettingsPage() {
  const user = await requireUser();

  const [plan, usage, summaries] = await Promise.all([
    getUserPlan(user.id),
    getLookupUsage(user.id),
    listMapSummaries(repoContext(user.id)),
  ]);

  return (
    <SettingsSection
      title="Usage"
      description={
        <>
          Against what your plan allows. Everything here is enforced when you save,
          not just drawn. Need more room?{" "}
          <Link href="/settings/billing" className="text-foreground underline underline-offset-2">
            Compare plans
          </Link>
          .
        </>
      }
    >
      <UsageGrid
        plan={plan}
        mapCount={summaries.length}
        places={fullest(summaries, (summary) => summary.placeCount)}
        shapes={fullest(summaries, (summary) => summary.shapeCount)}
        lookups={usage}
      />
    </SettingsSection>
  );
}

/**
 * The map with the most of something, and its name, or null when there are no
 * maps at all.
 *
 * Per limit, because both ceilings are per map: the map nearest to one is the
 * map that will refuse something first, and it is the one worth naming. Two
 * separate answers rather than one "biggest map", since the map with the most
 * locations is often not the one with the most shapes. Null rather than
 * zero-with-a-blank-name, so the meter decides what an empty account says.
 */
function fullest(
  summaries: { map: { name: string }; summary: { placeCount: number; shapeCount: number } }[],
  count: (summary: { placeCount: number; shapeCount: number }) => number,
): { count: number; mapName: string } | null {
  let best: { count: number; mapName: string } | null = null;

  for (const entry of summaries) {
    const value = count(entry.summary);
    if (!best || value > best.count) best = { count: value, mapName: entry.map.name };
  }

  return best;
}
