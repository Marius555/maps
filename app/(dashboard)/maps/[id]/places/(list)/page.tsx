import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlacesManager } from "@/components/places/places-manager";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/current-user";
import { repoContext } from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
import { loadMap } from "@/lib/repositories/load-map";
import { listAllPlaces } from "@/lib/repositories/places.repository";
import { PLAN_LIMITS, getUserPlan } from "@/lib/repositories/plan-limits";

export const metadata: Metadata = { title: "Locations" };

export default async function PlacesPage(props: PageProps<"/maps/[id]/places">) {
  const { id } = await props.params;
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
      />
    </Container>
  );
}

async function loadPlaces(userId: string, mapId: string) {
  const [map, places, plan] = await Promise.all([
    loadMap(userId, mapId),
    listAllPlaces(repoContext(userId), mapId),
    getUserPlan(userId),
  ]);

  return { map, places, placeLimit: PLAN_LIMITS[plan].places };
}
