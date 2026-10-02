/**
 * **Every plan limit in the app, in one file.** Change a number here and deploy;
 * nothing else needs to move.
 *
 * Enforced server-side in the repositories (CLAUDE.md §6) — `getUserPlan`,
 * `assertPlanFeature` and the checks that read these live in
 * `lib/repositories/plan-limits.ts`, which re-exports everything here so its
 * importers never had to change. Request-rate limits (how *often*, not how
 * *much*) are the other table in this folder, `rate.ts`. Both are explained, with
 * "how to change a limit", in docs/notes/limits.md.
 *
 * Two places copy these numbers and are held to them by tests rather than by
 * trust: `lib/marketing/plans.ts` (what the pricing page promises — checked by
 * `lib/marketing/plans.test.ts`) and CLAUDE.md §6's table. Raise a limit here
 * and the pricing test tells you which sentence on the page is now wrong.
 *
 * Plain data with no imports but a type, so anything may read it.
 */

import type { GatedFeature } from "@/lib/repositories/errors";

/** CLAUDE.md §6. Enforced in the repositories, never only in the UI. */
export const PLAN_LIMITS = {
  free: { maps: 1, places: 25, shapes: 3 },
  starter: { maps: 3, places: 300, shapes: 50 },
  pro: { maps: 15, places: 3000, shapes: 250 },
} as const;

/**
 * The analytics half of §6's table: how many visitor sessions a map may record
 * in a calendar month, and how long they are kept.
 *
 * **Separate from `PLAN_LIMITS` because these are not the same kind of number.**
 * Everything in that table is a thing the *owner* creates and can see; these two
 * bound something strangers cause. A map that hits its ceiling is not a customer
 * doing something wrong, so nothing here throws a `PlanLimitError` at anybody —
 * the collector simply stops writing and the dashboard says so.
 *
 * §6's plan table already reads "unlimited (badge shown)" under Views, and that
 * stays true: this caps rows we store, not maps a visitor may load. A map past
 * its ceiling keeps working perfectly for every visitor; it just stops being
 * measured until the month turns.
 *
 * **Not enforced against a real plan yet**, because everybody reads as `free`
 * until Week 4 wires up billing — which would cap every map on the app at a
 * thousand sessions. `SESSION_LIMITS.free` is therefore set where a free map
 * genuinely sits, and the pricing pass is what tightens it. Provisioned now for
 * the reason the `subscriptions` table was: so the code reaches its final shape
 * before the plan does.
 */
export const SESSION_LIMITS = {
  free: { sessionsPerMonth: 20_000, retentionDays: 30 },
  starter: { sessionsPerMonth: 200_000, retentionDays: 180 },
  pro: { sessionsPerMonth: 2_000_000, retentionDays: 365 },
} as const satisfies Record<
  PlanId,
  { sessionsPerMonth: number; retentionDays: number }
>;

export type PlanId = keyof typeof PLAN_LIMITS;

/**
 * How many upstream address lookups an account may cause in a calendar month.
 *
 * **Its own table rather than a fourth key in `PLAN_LIMITS`, for two reasons.**
 * The mechanical one: `lib/marketing/plans.test.ts` compares the page's numbers
 * to `PLAN_LIMITS[plan.id]` with an exact-shape `toEqual`, so a fourth key there
 * is a broken test rather than a new row. The real one is the same distinction
 * `SESSION_LIMITS` is drawn on — everything in `PLAN_LIMITS` is a thing the owner
 * *creates and can see*, and this bounds something they *spend*.
 *
 * A lookup is one request to the geocoder: an address searched, a pin dropped or
 * dragged, a row geocoded on import or on a sheet sync, or one pin asked about by
 * the route tool's routability sweep. They are pooled because the provider pools
 * them — on Geoapify a routing `nearest()` probe is billed as a reverse geocode,
 * so counting routing separately would describe a bill nobody sends us.
 *
 * **Sized above full entitlement, deliberately.** Pro's 15 maps × 3,000 places is
 * 45,000 locations, and importing all of them inside one month has to work — a
 * ceiling that refuses a customer using exactly what they paid for is a bug with
 * a number attached. So 50,000 is entitlement plus slack, and at roughly
 * $0.20/1,000 on a hosted provider the worst case is about $10 against ~€35.80 net
 * of the merchant-of-record's fee. The property to preserve when these move: the
 * plan must still be profitable *at its ceiling*.
 *
 * What this number is therefore for is scripted abuse, not thrift. Bursts — one
 * import draining a shared daily allowance and stalling every other customer —
 * are the daily circuit breaker's job in `usage.repository.ts`, not this table's.
 */
export const LOOKUP_LIMITS = {
  free: { perMonth: 250 },
  starter: { perMonth: 4_000 },
  pro: { perMonth: 50_000 },
} as const satisfies Record<PlanId, { perMonth: number }>;

/**
 * What a plan can do, as against how much of it. §6's table is quantities; this
 * is the on/off half, kept beside it so a plan is described in one place.
 *
 * Routes are here because they are the one feature whose cost is not already
 * bounded by a quantity somewhere else. A location is geocoded once, ever, and
 * the place ceiling caps how many of those there can be — but a map with three
 * pins can have its route redrawn all afternoon, and arming the tool probes
 * every pin on the map besides. So the gate is both the pricing decision and
 * the spend cap, which is why it is enforced on the two endpoints that reach
 * the engine rather than only hidden in the toolbar.
 *
 * Sheet sync is here on the same argument. Importing a sheet once is free on
 * every plan; keeping a map linked to one re-reads it every day and geocodes
 * whatever changed, which is spend nobody pressed a button for. Enforced where
 * the link is created and again on every sync, so a downgraded account's links
 * go quiet rather than keep spending.
 *
 * Analytics is the odd one out: it is a pricing decision and not a cost one. Its
 * cost is already bounded by `SESSION_LIMITS`, and it is gated because it is what
 * the paid plans are *worth* — the comparable products charge between $39 and $70
 * a month for this one tab. Enforced on the page that reads it and again in
 * `loadCollectGate`, so a free map stops being written to as well as stops being
 * shown; a map that was free therefore records nothing, and upgrading starts its
 * history that day rather than backfilling one.
 *
 * `noBadge` is the other pricing line: a free map carries a small "Made with"
 * link, which is how a stranger's visitor finds us, and paying removes it. Read
 * at publish (publish.repository.ts) — so a plan change reaches a live map on its
 * next publish, never by itself, which is §7's rule for everything in a snapshot.
 *
 * `support` is the Contact support form in the account menu — email support is
 * what the paid plans promise. Reporting a bug is not gated; see
 * `lib/support/support-request.ts`.
 */
export const PLAN_FEATURES = {
  free: { routes: false, sheetSync: false, analytics: false, noBadge: false, support: false },
  starter: { routes: true, sheetSync: true, analytics: true, noBadge: true, support: true },
  pro: { routes: true, sheetSync: true, analytics: true, noBadge: true, support: true },
} as const satisfies Record<PlanId, Record<GatedFeature, boolean>>;

/**
 * How many filter groups a map may hold, on every plan.
 *
 * Not a pricing line — a floor under the editor. A group normally cannot
 * outnumber the locations in it, but empty groups can be made, and past 2,000
 * `listAllGroups` refuses to page any further, which breaks both publishing and
 * the editor for that map. 500 is far above any real map and far below that.
 */
export const MAX_GROUPS_PER_MAP = 500;
