import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MapEditor } from "@/components/editor/map-editor";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/current-user";
import { repoContext } from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
import { loadMap } from "@/lib/repositories/load-map";
import { listAllPlaces } from "@/lib/repositories/places.repository";
import { PLAN_LIMITS, getUserPlan } from "@/lib/repositories/plan-limits";

export async function generateMetadata(
  props: PageProps<"/maps/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;

  try {
    const user = await requireUser();
    const map = await loadMap(user.id, id);
    return { title: map.name };
  } catch {
    return { title: "Map" };
  }
}

export default async function MapEditorPage(props: PageProps<"/maps/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const ctx = repoContext(user.id);

  // The try only wraps the fetch. Rendering happens after it: React doesn't
  // render children eagerly, so a catch around JSX would never fire anyway.
  let data: Awaited<ReturnType<typeof loadEditor>>;

  try {
    data = await loadEditor(ctx, id, user.id);
  } catch (error) {
    // A map that doesn't exist and a map owned by someone else are the same
    // answer here, by design.
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    // `flex flex-col` so the editor inside can claim the remaining height — the
    // map needs a definite height or MapLibre renders into a zero-height canvas.
    <Container className="flex flex-col">
      <MapEditor
        map={data.map}
        initialPlaces={data.places}
        placeLimit={data.placeLimit}
      />
    </Container>
  );
}

async function loadEditor(
  ctx: ReturnType<typeof repoContext>,
  mapId: string,
  userId: string,
) {
  const [map, places, plan] = await Promise.all([
    loadMap(userId, mapId),
    listAllPlaces(ctx, mapId),
    getUserPlan(userId),
  ]);

  return { map, places, placeLimit: PLAN_LIMITS[plan].places };
}
