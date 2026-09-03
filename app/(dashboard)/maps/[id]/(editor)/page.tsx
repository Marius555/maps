import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MapEditor } from "@/components/editor/map-editor";
import { Container } from "@/components/ui/container";
import { PageTitle } from "@/components/ui/page-title";
import { requireUser } from "@/lib/auth/current-user";
import { getCardDesign } from "@/lib/repositories/card-design.repository";
import { repoContext } from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
import { listAllGroups } from "@/lib/repositories/groups.repository";
import { loadMap } from "@/lib/repositories/load-map";
import { listAllPlaces } from "@/lib/repositories/places.repository";
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  getUserPlan,
} from "@/lib/repositories/plan-limits";
import { listAllShapes } from "@/lib/repositories/shapes.repository";

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
    // `min-h-0` so it can also be *squeezed*: without it a flex item refuses to
    // go below its content, and a panel full of locations would push the page
    // taller instead of scrolling. See the height note in map-editor.tsx.
    <Container className="flex min-h-0 flex-col">
      {/* The map's own name, since this page is the map. Every other section
          names itself; this one would only be "Map". */}
      <PageTitle>{data.map.name}</PageTitle>

      <MapEditor
        map={data.map}
        initialPlaces={data.places}
        initialShapes={data.shapes}
        initialGroups={data.groups}
        initialCardDesign={data.cardDesign}
        plan={data.plan}
        placeLimit={data.placeLimit}
        shapeLimit={data.shapeLimit}
        canDrawRoutes={data.canDrawRoutes}
      />
    </Container>
  );
}

async function loadEditor(
  ctx: ReturnType<typeof repoContext>,
  mapId: string,
  userId: string,
) {
  const [map, places, shapes, groups, cardDesign, plan] = await Promise.all([
    loadMap(userId, mapId),
    listAllPlaces(ctx, mapId),
    listAllShapes(ctx, mapId),
    listAllGroups(ctx, mapId),
    getCardDesign(ctx),
    getUserPlan(userId),
  ]);

  return {
    map,
    places,
    shapes,
    groups,
    cardDesign,
    /*
     * The plan's own name, for the sentence the toolbar now says *before* the
     * click — "…included on the free plan". `planLimitUsage` composes it from
     * the resource, the ceiling and this, and nothing else on the client knows
     * which plan the user is on.
     */
    plan,
    placeLimit: PLAN_LIMITS[plan].places,
    /*
     * The shape limit is back, and the importer is what wanted it.
     *
     * It went away when shapes moved inline with the locations and the sidebar
     * dropped its shapes badge, because nothing read it. Drawing a shape never
     * needed it either: you draw one at a time, and the server refusing the
     * eleventh is a toast at exactly the right moment.
     *
     * An import is the case that breaks. Thirteen provinces against a limit of
     * three has to be said *before* the button, with the number in it, and the
     * dialog cannot work that out from a rejection it has not made yet.
     *
     * The Draw menu wants it now too, for the same reason one step earlier: it
     * greys its tools at the ceiling rather than arming a gesture whose save is
     * already refused.
     */
    shapeLimit: PLAN_LIMITS[plan].shapes,
    /*
     * Routes are a paid feature, and this is the half of that the browser is
     * allowed to know. The enforcing half is on the two endpoints that reach
     * the engine — a greyed menu row is a courtesy, not the rule (§6).
     */
    canDrawRoutes: PLAN_FEATURES[plan].routes,
    // No group limit: a group cannot outnumber the places and shapes in it, and
    // those are limited already. See §6's table, which has no row for groups.
  };
}
