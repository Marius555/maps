import "server-only";

import { cache } from "react";

import { repoContext } from "./context";
import { getMap } from "./maps.repository";
import type { AppMap } from "./types";

/**
 * Per-request cached map read.
 *
 * A map's layout and its page both need the map, and the layout renders on every
 * navigation between the editor, locations and settings. `cache()` memoises on
 * argument identity, so the arguments are primitives — passing a RepoContext
 * object would make every call a cache miss.
 */
export const loadMap = cache(
  async (userId: string, mapId: string): Promise<AppMap> =>
    getMap(repoContext(userId), mapId),
);
