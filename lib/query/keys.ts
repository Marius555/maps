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
} as const;
