/**
 * Declarative Appwrite schema. Data only — no SDK calls live here.
 *
 * `setup-appwrite.mjs` walks this and creates whatever is missing. Keep this file
 * the single source of truth: if you change a column here, change it in the
 * Appwrite console too (the script never alters an existing column, by design).
 *
 * Column notes worth remembering:
 * - `lat`/`lng` are plain floats, not Point columns (CLAUDE.md §6). "Find nearest"
 *   runs client-side against the published snapshot, so a spatial index buys
 *   nothing and would constrain self-hosting.
 * - `address` is optional. Dropping a pin on the map gives us coordinates and
 *   nothing else; a required address would make that impossible to save.
 * - `email`/`url` are varchar, not Appwrite's native email/url column types.
 *   Those types reject the empty string, which would 400 every place saved
 *   without contact details. Zod validates the format instead.
 * - Long, never-queried values (`categories`, `settings`, `description`, `hours`,
 *   `snapshotUrl`) are `text`: stored off-page, so they don't eat the 64KB row limit.
 */

/** @typedef {{ key: string, type: string } & Record<string, unknown>} Column */

const varchar = (key, size, opts = {}) => ({
  type: "varchar",
  key,
  size,
  required: false,
  ...opts,
});
const text = (key, opts = {}) => ({ type: "text", key, required: false, ...opts });
const float = (key, opts = {}) => ({ type: "float", key, required: false, ...opts });
const integer = (key, opts = {}) => ({ type: "integer", key, required: false, ...opts });
const datetime = (key, opts = {}) => ({ type: "datetime", key, required: false, ...opts });
const enumeration = (key, elements, opts = {}) => ({
  type: "enum",
  key,
  elements,
  required: false,
  ...opts,
});

export const GEOCODE_STATUSES = ["ok", "low", "failed", "manual"];
export const PLANS = ["free", "starter", "pro"];
export const SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "canceled",
  "paused",
  "trialing",
];

export const TABLES = [
  {
    id: "maps",
    name: "Maps",
    columns: [
      varchar("userId", 36, { required: true }),
      varchar("name", 128, { required: true }),
      varchar("slug", 64, { required: true }),
      varchar("style", 32, { xdefault: "liberty" }),
      float("defaultLat", { required: true, min: -90, max: 90 }),
      float("defaultLng", { required: true, min: -180, max: 180 }),
      float("defaultZoom", { required: true, min: 0, max: 24 }),
      text("categories"),
      text("settings"),
      // 253 is the maximum length of a DNS name.
      varchar("allowedDomains", 253, { array: true }),
      datetime("publishedAt"),
      text("snapshotUrl"),
    ],
    indexes: [
      { key: "idx_maps_userId", type: "key", columns: ["userId"], orders: ["asc"] },
      { key: "idx_maps_slug", type: "unique", columns: ["slug"], orders: ["asc"] },
    ],
  },
  {
    id: "places",
    name: "Places",
    columns: [
      varchar("mapId", 36, { required: true }),
      varchar("name", 255, { required: true }),
      float("lat", { required: true, min: -90, max: 90 }),
      float("lng", { required: true, min: -180, max: 180 }),
      varchar("address", 512, { xdefault: "" }),
      varchar("category", 64, { xdefault: "" }),
      text("description"),
      varchar("phone", 32),
      varchar("email", 254),
      varchar("url", 512),
      text("hours"),
      varchar("photoId", 36),
      integer("sortOrder", { min: 0, xdefault: 0 }),
      float("geocodeConfidence", { min: 0, max: 1 }),
      enumeration("geocodeStatus", GEOCODE_STATUSES, { xdefault: "manual" }),
    ],
    indexes: [
      { key: "idx_places_mapId", type: "key", columns: ["mapId"], orders: ["asc"] },
      {
        key: "idx_places_map_sort",
        type: "key",
        columns: ["mapId", "sortOrder"],
        orders: ["asc", "asc"],
      },
    ],
  },
  {
    // Read-only in Week 1 — every user resolves to 'free'. Provisioned now so
    // plan-limits.ts reaches its final shape instead of hardcoding the plan.
    id: "subscriptions",
    name: "Subscriptions",
    columns: [
      varchar("userId", 36, { required: true }),
      varchar("billingCustomerId", 128),
      varchar("billingSubscriptionId", 128),
      enumeration("plan", PLANS, { xdefault: "free" }),
      enumeration("status", SUBSCRIPTION_STATUSES, { xdefault: "active" }),
      datetime("currentPeriodEnd"),
    ],
    indexes: [
      { key: "idx_subs_userId", type: "unique", columns: ["userId"], orders: ["asc"] },
    ],
  },
];

/**
 * One bucket holds both uploaded photos and published snapshots.
 *
 * A separate snapshots bucket would be tidier — different write patterns,
 * different lifecycles — but Appwrite Cloud's free plan allows exactly one
 * bucket per project, so insisting on two would make the app impossible to run
 * without a paid plan. Both kinds of file are public-read and destined for the
 * same visitor's browser, so sharing costs nothing but neatness.
 *
 * `SNAPSHOT_STORAGE_ID` still exists and still defaults to `STORAGE_ID`. Setting
 * it to something else on a paid plan splits the two apart with no code change;
 * add a second entry to BUCKETS when that happens.
 */
export const ASSET_BUCKET = {
  envKey: "STORAGE_ID",
  name: "Map assets",
  fileSecurity: true,
  // Photos are capped at 5MB in code (lib/validation/photo.ts). The larger
  // ceiling here is for snapshots: a 3,000-place Pro map lands near 600KB.
  maximumFileSize: 10 * 1024 * 1024,
  // json is for published snapshots; the rest are place photos. Every image
  // format here is already compressed, which is why compression stays off —
  // snapshots are small enough that the asymmetry doesn't pay for a second
  // bucket.
  allowedFileExtensions: ["jpg", "jpeg", "png", "webp", "avif", "json"],
  compression: "none",
  encryption: false,
  antivirus: true,
};

export const BUCKETS = [ASSET_BUCKET];
