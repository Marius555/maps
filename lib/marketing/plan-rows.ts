import type { MarketingPlan } from "./plans";

/**
 * What a plan card lists, and in what order.
 *
 * **Extracted because two pages draw it now.** `/pricing` sells to a stranger and
 * Settings → Billing shows a customer what they already have against what they could
 * have; the layouts differ, the rows must not. The labels used to live inside
 * `components/marketing/plans/plan-card.tsx`, which meant the second caller would
 * have retyped them — and a limit described as "Areas and routes drawn" on one
 * page and "Shapes" on the other is the same bug as a price that disagrees, just
 * quieter.
 *
 * The numbers still come from `MARKETING_PLANS`, which `plans.test.ts` holds to
 * the repositories' own tables. Nothing here invents a value; this is the order
 * and the wording only.
 *
 * A plain module, no `server-only` and no dependencies, so a client component can
 * import it — `plan-compare.tsx` is one.
 */

/**
 * A stable key per row, so a comparison can line two plans up without matching on
 * label text. Renaming a label must not silently stop a row being compared.
 */
export type PlanRowId =
  | "maps"
  | "places"
  | "shapes"
  | "views"
  | "lookups"
  | "routes"
  | "sheetSync"
  | "analytics";

export type PlanRow = {
  id: PlanRowId;
  label: string;
} & (
  | { kind: "quantity"; value: number }
  /** `note` overrides the default "Included" / "Not on this plan" wording. */
  | { kind: "feature"; on: boolean; note?: string }
);

export function planRows(plan: MarketingPlan): PlanRow[] {
  return [
    { id: "maps", kind: "quantity", label: "Maps", value: plan.maps },
    {
      id: "places",
      kind: "quantity",
      label: "Locations on a map",
      value: plan.places,
    },
    {
      id: "shapes",
      kind: "quantity",
      label: "Areas and routes drawn",
      value: plan.shapes,
    },
    /*
     * The row that is the whole argument, and it is identical on every plan on
     * purpose — CLAUDE.md §2 is the reason there is no per-view price to print.
     */
    { id: "views", kind: "feature", label: "Views", on: true, note: "Unlimited" },
    /*
     * Stated, because it is the one limit here a customer can reach without doing
     * anything they would call "adding" something. A ceiling nobody was told about
     * is discovered as a refusal mid-import.
     */
    {
      id: "lookups",
      kind: "quantity",
      label: "Address lookups a month",
      value: plan.lookups,
    },
    {
      id: "routes",
      kind: "feature",
      label: "Routes with drive times",
      on: plan.routes,
    },
    {
      id: "sheetSync",
      kind: "feature",
      label: "Google Sheets sync",
      on: plan.sheetSync,
    },
    {
      id: "analytics",
      kind: "feature",
      label: "Visitor analytics",
      on: plan.analytics,
    },
  ];
}
