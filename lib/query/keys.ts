/** Single source of truth for cache keys. Invalidations reference these, never literals. */
export const queryKeys = {
  me: ["me"] as const,
  maps: {
    all: ["maps"] as const,
    list: () => ["maps", "list"] as const,
    detail: (mapId: string) => ["maps", "detail", mapId] as const,
  },
  places: {
    all: (mapId: string) => ["maps", mapId, "places"] as const,
    list: (mapId: string) => ["maps", mapId, "places", "list"] as const,
  },
  shapes: {
    all: (mapId: string) => ["maps", mapId, "shapes"] as const,
    list: (mapId: string) => ["maps", mapId, "shapes", "list"] as const,
  },
  groups: {
    all: (mapId: string) => ["maps", mapId, "groups"] as const,
    list: (mapId: string) => ["maps", mapId, "groups", "list"] as const,
  },
  /** The map's link to a Google Sheet, or null — see lib/sheet-sync. */
  sheetLink: (mapId: string) => ["maps", mapId, "sheetLink"] as const,
  /**
   * The card design of the workspace a map is in — one per workspace (see
   * lib/repositories/card-design.repository.ts), keyed by map because the map is
   * what names the workspace. Maps in one workspace share the design, so a save
   * refreshes every key ending in "cardDesign".
   */
  cardDesign: (mapId: string) => ["maps", mapId, "cardDesign"] as const,
  /** One page of the account's invoices, as the provider lists them. */
  invoices: (page: number) => ["invoices", page] as const,
  /** Who redeemed one discount code, a page at a time (operator console). */
  discountRedemptions: (discountId: string, page: number) =>
    ["discount-redemptions", discountId, page] as const,
  /** The account's notifications and unread count — lib/notifications. */
  notifications: ["notifications"] as const,
} as const;
