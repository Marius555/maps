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
 * - Long, never-queried values (`categories`, `pinIcons`, `settings`, `appearance`,
 *   `description`,
 *   `hours`, `snapshotUrl`) are `text`: stored off-page, so they don't eat the 64KB
 *   row limit.
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
export const SHAPE_KINDS = ["circle", "polygon", "line"];
// Hand-copied from packages/shared/shapes.ts, the way SHAPE_KINDS is copied from
// lib/validation/shape.schema.ts: this script is plain .mjs and cannot import TS.
export const SHAPE_STROKE_STYLES = ["solid", "dashed", "dotted"];
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
      // The pins the customer built: name, colour, and either a built-in glyph
      // or their own logo inlined as a data URI. Capped in code at 8 pins of 6KB
      // (lib/validation/pin-icon.schema.ts), so worst case is ~64KB of text.
      text("pinIcons"),
      text("settings"),
      // What the owner did to the basemap beyond picking one: the label level
      // and the layer toggles. Its own column rather than another key in
      // `settings`, because `settings` belongs to the Publish tab and is written
      // whole — two forms writing one blob is a lost update.
      text("appearance"),
      /*
       * The map's own filter vocabulary: groups of tags a location can wear.
       * `[{ id, label, tags: [{ id, label }] }]`.
       *
       * A second axis beside `categories`, not a replacement for it. A category
       * is what colours a pin, so a place has exactly one; a tag says something
       * else about it — what it stocks, what it offers — and a place has as many
       * as apply. Merging them would mean a stockist that sells three product
       * lines needed three pins in three colours at one address.
       */
      text("tagGroups"),
      /*
       * Extra fields this map's locations carry, defined once here and filled in
       * per place: `[{ id, label, type, showAs }]`. The values live on the place.
       *
       * The definitions are the map's because they are a promise about the whole
       * set — an import maps a column to one of these, and a popup renders them
       * in this order. Storing a label per place instead would let two rows
       * spell the same field differently and there would be no way to tell.
       */
      text("fields"),
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
      /*
       * Tag ids from the map's own `tagGroups`. A real array column rather than
       * JSON, because unlike `hours` this is the one new value worth being able
       * to query on later — "every stockist carrying product X" is a question
       * somebody will eventually ask of the dashboard.
       *
       * An id no longer defined on the map reads as absent: the snapshot narrows
       * to defined tags, and nothing clears these on delete (there is no
       * array-remove in Appwrite, and rewriting 3,000 rows to tidy up ids no
       * visitor can see is not a trade worth making). Same call the codebase
       * already makes for `groupId`. It only holds because tag ids are minted
       * fresh and never reused — see lib/validation/tag.schema.ts.
       */
      varchar("tags", 64, { array: true }),
      // Which icon the pin wears: a built-in id, or `custom:<pinIconId>` naming
      // one of the map's own pins. A plain string, not an enum, so an unknown id
      // degrades to a plain pin instead of failing a write — which is what a
      // place keeps doing after the custom pin it named is deleted.
      varchar("icon", 64, { xdefault: "" }),
      text("description"),
      varchar("phone", 32),
      varchar("email", 254),
      varchar("url", 512),
      text("hours"),
      /*
       * The location's photos, cover first.
       *
       * A real array column rather than JSON, on the same argument `tags` makes:
       * these are ids, they are read whole, and reordering one is a write of the
       * array rather than a rewrite of a text blob.
       *
       * `photoId` below is the single-photo column this replaced, and it is
       * never written again — every write here also clears it. So the gallery is
       * "`photoIds` if the row has any, else the legacy `photoId`", which is one
       * source of truth at every instant, and rows written before this column
       * existed keep showing the photo they always showed with no migration.
       */
      varchar("photoIds", 36, { array: true }),
      varchar("photoId", 36),
      integer("sortOrder", { min: 0, xdefault: 0 }),
      float("geocodeConfidence", { min: 0, max: 1 }),
      enumeration("geocodeStatus", GEOCODE_STATUSES, { xdefault: "manual" }),
      // The geocoder's answer in parts — postcode, city, country, OSM ids. JSON
      // for the same reason `hours` is: it is read whole and never queried on.
      text("addressParts"),
      // This place's answers to the map's own extra fields: `{ [fieldId]: value }`.
      // JSON on the same argument as `hours` and `addressParts` — read whole,
      // rendered whole, never queried on. The labels and order live on the map,
      // so two rows cannot spell one field differently.
      text("fields"),
      // Which group this location belongs to, or "" for none — the same way
      // `category` and `icon` already spell "nothing chosen".
      varchar("groupId", 36, { xdefault: "" }),
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
    // Areas rather than points: a delivery radius, a service region, a campus
    // boundary. A row per shape rather than JSON on the map, because a polygon
    // ring is unbounded text and dragging a vertex would otherwise rewrite the
    // whole map document.
    id: "shapes",
    name: "Shapes",
    columns: [
      varchar("mapId", 36, { required: true }),
      varchar("name", 128, { required: true }),
      // The discriminator, and it lives only here. The geometry column holds the
      // payload alone, so there is no second copy of the kind to disagree with
      // this one.
      enumeration("kind", SHAPE_KINDS, { required: true }),
      text("description"),
      // Its own colour, not a category's. Categories are a locations taxonomy —
      // filtering "Cafés" in the embed must not make a boundary disappear.
      varchar("color", 7, { xdefault: "#1c7ed6" }),
      // A fill dark enough to read as a region, light enough to see the map
      // through. The stroke is drawn at full opacity regardless.
      float("opacity", { min: 0, max: 1, xdefault: 0.2 }),
      /*
       * How the outline is drawn. Absent means what every shape drawn before
       * these columns existed was drawn as, which is what lets them ship with no
       * migration and no republish.
       *
       * 0 is not a width, it is "the default for this kind" — 4px for a line, 2px
       * for an area's edge. That default depends on the kind, so no column
       * default could hold it; strokeWidthOf in packages/shared/shapes.ts is
       * where it actually lives, and both renderers ask it.
       */
      integer("strokeWidth", { min: 0, max: 12, xdefault: 0 }),
      enumeration("strokeStyle", SHAPE_STROKE_STYLES, { xdefault: "solid" }),
      // A circle's centre and radius, or a polygon's ring. JSON for the same
      // reason `hours` is: read whole, never queried on, and unbounded in length.
      text("geometry", { required: true }),
      integer("sortOrder", { min: 0, xdefault: 0 }),
      // Same column, same meaning, same "" for none as on places. A group holds
      // both kinds, which is the point of it.
      varchar("groupId", 36, { xdefault: "" }),
    ],
    indexes: [
      { key: "idx_shapes_mapId", type: "key", columns: ["mapId"], orders: ["asc"] },
      {
        key: "idx_shapes_map_sort",
        type: "key",
        columns: ["mapId", "sortOrder"],
        orders: ["asc", "asc"],
      },
    ],
  },
  {
    // Locations and shapes the owner has bundled together — a region, a
    // franchise, a campus. Editor-only: groups are never written to a published
    // snapshot, because a visitor cannot see or act on one, and bytes in the
    // snapshot are bytes in every embed (§2, §4).
    //
    // A row rather than JSON on the map, for the reason shapes are: the members
    // point *here* by id, so grouping one location is a one-column PATCH on that
    // location instead of a rewrite of a list on the map document.
    //
    // No plan limit. Groups cannot outnumber the places and shapes they contain,
    // which are limited already, and §6's table has no row for them.
    id: "groups",
    name: "Groups",
    columns: [
      varchar("mapId", 36, { required: true }),
      varchar("name", 128, { required: true }),
      // Used to tint the group's row and its members' selection ring in the
      // editor. Not a category colour and not a shape's — it never reaches a map.
      varchar("color", 7, { xdefault: "#495057" }),
      integer("sortOrder", { min: 0, xdefault: 0 }),
    ],
    indexes: [
      { key: "idx_groups_mapId", type: "key", columns: ["mapId"], orders: ["asc"] },
      {
        key: "idx_groups_map_sort",
        type: "key",
        columns: ["mapId", "sortOrder"],
        orders: ["asc", "asc"],
      },
    ],
  },
  {
    // The design of the card a visitor sees when they click a location: which
    // blocks it holds, in which of its three zones, and how big each one is.
    // One row per account, found by `userId` rather than a fixed row id — every
    // map an owner has shares one card design, so a customer with three maps
    // redesigns the popup once rather than three times. Used to live as a
    // `cardLayout` column on `maps`; that column is still there, unused, since
    // this script never drops one.
    id: "cardDesigns",
    name: "Card designs",
    columns: [
      varchar("userId", 36, { required: true }),
      // Bounded by the zone rules in packages/shared/card-layout.ts (only
      // dividers and spacers repeat), so a real card is a dozen small objects;
      // `text` regardless, because it is read whole and never queried on.
      text("cardLayout"),
    ],
    indexes: [
      {
        key: "idx_carddesigns_userId",
        type: "unique",
        columns: ["userId"],
        orders: ["asc"],
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
