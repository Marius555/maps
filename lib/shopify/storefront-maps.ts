/**
 * What the theme block reads: the app-data metafield `pinglide.maps` on the
 * app installation (`app.metafields.pinglide.maps` in Liquid —
 * distribution/shopify/extensions/pinglide-map/blocks/map.liquid).
 *
 *   { "default": "<mapId>" | null,
 *     "script": "https://cdn.pinglide.com/embed/v1/map.js",
 *     "maps": { "<mapId>": { "name": "…", "snapshot": "https://…/live.json" } } }
 *
 * Pure, so the merge rules are tested without Shopify. The keys are the
 * Liquid's contract — rename one here and every storefront block stops
 * finding its map. Only public values go in: the snapshot URL is already on
 * every page the map is shown on, and a metafield read by Liquid is public.
 *
 * Beside it, each map on the list is also a `$app:map` metaobject
 * (`storefrontMapFields`), which is what the block's "Map" picker offers. This
 * list stays the source for the default map and for `script`.
 */

export type StorefrontMap = { name: string; snapshot: string };

export type StorefrontMaps = {
  default: string | null;
  script: string;
  maps: Record<string, StorefrontMap>;
};

/** The stored value, tolerating anything malformed as "nothing stored yet". */
export function parseStorefrontMaps(value: string | null | undefined): StorefrontMaps | null {
  if (!value) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const maps: Record<string, StorefrontMap> = {};

  if (record.maps && typeof record.maps === "object") {
    for (const [id, entry] of Object.entries(record.maps as Record<string, unknown>)) {
      const map = entry as Partial<StorefrontMap> | null;
      if (map && typeof map.snapshot === "string" && map.snapshot) {
        maps[id] = { name: typeof map.name === "string" ? map.name : "", snapshot: map.snapshot };
      }
    }
  }

  const fallback = typeof record.default === "string" ? record.default : null;

  return {
    default: fallback && fallback in maps ? fallback : null,
    script: typeof record.script === "string" ? record.script : "",
    maps,
  };
}

/**
 * Put a map on the storefront list. It becomes the default when asked to, or
 * when there is no default yet — so the first map a shop shows needs no map
 * code in the theme editor.
 */
export function withStorefrontMap(
  current: StorefrontMaps | null,
  mapId: string,
  map: StorefrontMap,
  { makeDefault, script }: { makeDefault: boolean; script: string },
): StorefrontMaps {
  const maps = { ...(current?.maps ?? {}), [mapId]: map };
  const keep = current?.default && current.default in maps ? current.default : null;

  return { default: makeDefault || !keep ? mapId : keep, script, maps };
}

/**
 * The list with `script` pointed at where `map.js` is served now, or `null`
 * when it already is. A dev tunnel dies with every `shopify app dev`, and the
 * list is otherwise rewritten only by "Show on storefront" — which a map
 * already on the storefront never offers — so without this every block on the
 * dev store stays blank from the next restart on.
 */
export function withScript(current: StorefrontMaps | null, script: string): StorefrontMaps | null {
  if (!current || current.script === script) return null;
  return { ...current, script };
}

/**
 * The `$app:map` metaobject's fields for one storefront map — what the theme
 * block's "Map" picker lists (`name`) and loads (`snapshot`). Both are required
 * by the definition (distribution/shopify/shopify.app.toml), so an unnamed map
 * still gets a name.
 */
export function storefrontMapFields(map: StorefrontMap): { key: string; value: string }[] {
  return [
    { key: "name", value: pickerName(map.name) },
    { key: "snapshot", value: map.snapshot },
  ];
}

/** What the picker lists a map as — compared, too, to tell whether an entry is stale. */
export function pickerName(name: string): string {
  return name.trim() || "Untitled map";
}

/** Take a map off the list; the default moves to whichever map is left first. */
export function withoutStorefrontMap(current: StorefrontMaps | null, mapId: string): StorefrontMaps | null {
  if (!current) return null;

  const maps = { ...current.maps };
  delete maps[mapId];

  const fallback =
    current.default && current.default !== mapId && current.default in maps
      ? current.default
      : (Object.keys(maps)[0] ?? null);

  return { ...current, default: fallback, maps };
}
