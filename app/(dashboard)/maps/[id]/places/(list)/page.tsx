import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlacesManager } from "@/components/places/places-manager";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/current-user";
import {
  PLACE_FILTERS,
  UNTAGGED_FILTER_ID,
  type PlaceFilter,
} from "@/lib/places/place-filters";
import { repoContext } from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
import { loadMap } from "@/lib/repositories/load-map";
import { listAllPlaces } from "@/lib/repositories/places.repository";
import { PLAN_LIMITS, getUserPlan } from "@/lib/repositories/plan-limits";
import type { AppMap } from "@/lib/repositories/types";
import { tagGroupIndex } from "@/packages/shared/tags";

export const metadata: Metadata = { title: "Locations" };

export default async function PlacesPage(props: PageProps<"/maps/[id]/places">) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const user = await requireUser();

  // The try wraps only the fetch — see the settings page for why.
  let data: Awaited<ReturnType<typeof loadPlaces>>;

  try {
    data = await loadPlaces(user.id, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <Container size="centered">
      <PlacesManager
        initialMap={data.map}
        initialPlaces={data.places}
        placeLimit={data.placeLimit}
        initialFilter={readFilter(search.filter)}
        initialTagIds={readTagIds(search.tag, data.map)}
      />
    </Container>
  );
}

/**
 * The filter named in the address bar, if it is one we have.
 *
 * The Analytics table links every count it reports to the list of rows behind it
 * — `?filter=failed` and so on. Anything else, including nothing, is "no filter":
 * an unreadable value must not produce an empty list with no explanation for it,
 * and it must certainly not throw on a page somebody reached by editing a URL.
 */
function readFilter(raw: string | string[] | undefined): PlaceFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;

  return PLACE_FILTERS.includes(value as PlaceFilter) ? (value as PlaceFilter) : "";
}

/**
 * The tags named in the address bar, narrowed to ones this map still defines.
 *
 * Narrowed for the same reason `tagChipsOf` narrows: a tag id can outlive the tag
 * — a stale bookmark, a link from a page rendered before someone deleted it — and
 * filtering on one nothing can match is an empty list that looks like a bug.
 * `UNTAGGED_FILTER_ID` is not a tag and is deliberately allowed through.
 */
function readTagIds(
  raw: string | string[] | undefined,
  map: AppMap,
): string[] | undefined {
  if (!raw) return undefined;

  const requested = Array.isArray(raw) ? raw : [raw];
  const defined = tagGroupIndex(map.tagGroups);

  const ids = requested.filter(
    (id) => id === UNTAGGED_FILTER_ID || defined.has(id),
  );

  return ids.length > 0 ? ids : undefined;
}

async function loadPlaces(userId: string, mapId: string) {
  const [map, places, plan] = await Promise.all([
    loadMap(userId, mapId),
    listAllPlaces(repoContext(userId), mapId),
    getUserPlan(userId),
  ]);

  return { map, places, placeLimit: PLAN_LIMITS[plan].places };
}
