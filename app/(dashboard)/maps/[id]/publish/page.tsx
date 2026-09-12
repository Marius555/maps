import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishPanel } from "@/components/publish/publish-panel";
import { requireUser } from "@/lib/auth/current-user";
import { getCardDesign } from "@/lib/repositories/card-design.repository";
import { repoContext } from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
import { listAllGroups } from "@/lib/repositories/groups.repository";
import { loadMap } from "@/lib/repositories/load-map";
import { listAllPlaces } from "@/lib/repositories/places.repository";
import { listAllShapes } from "@/lib/repositories/shapes.repository";

export const metadata: Metadata = { title: "Publish" };

export default async function MapPublishPage(
  props: PageProps<"/maps/[id]/publish">,
) {
  const { id } = await props.params;
  const user = await requireUser();

  // The try wraps only the fetch. JSX built inside a catch's scope isn't covered
  // by it — React renders children later, so the catch would never fire.
  let data: Awaited<ReturnType<typeof loadPublishData>>;

  try {
    data = await loadPublishData(user.id, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  /*
   * No `Container` at all, and that is the point rather than an oversight.
   *
   * This page's left column stands where the app nav does everywhere else
   * (`lib/layout/app-nav.ts`), so it has to reach the window edge — inside
   * `Container`'s own `py-6` it would be a floating card pretending to be a
   * sidebar. The map takes the rest, edge to edge, which is also the only way
   * the preview is wide enough to draw the desktop layout a visitor gets.
   */
  return (
    <PublishPanel
      initialMap={data.map}
      initialPlaces={data.places}
      initialShapes={data.shapes}
      initialGroups={data.groups}
      initialCardDesign={data.cardDesign}
    />
  );
}

async function loadPublishData(userId: string, mapId: string) {
  // Places and shapes come along so the panel can tell the customer their
  // published map is behind the editor — neither kind of edit touches the map row.
  //
  // The card design comes along for a different reason: the preview draws the
  // account's own card, and fetching it from the browser means the first
  // document is built against the *default* card and then thrown away and
  // rebuilt when the real one lands. One more query here, one less full
  // MapLibre boot on every visit — see `EmbedPreview`'s `cardDesign`.
  //
  // Groups come along for a third reason again: the preview is the real embed
  // reading a snapshot built in the browser, and a group decides what colour a
  // pin or a route is painted (lib/map/group-colors.ts). Fetched here rather
  // than from the browser so the preview never draws the ungrouped colours once
  // and then rebuilds — the same argument the card design makes above.
  const [map, places, shapes, groups, cardDesign] = await Promise.all([
    loadMap(userId, mapId),
    listAllPlaces(repoContext(userId), mapId),
    listAllShapes(repoContext(userId), mapId),
    listAllGroups(repoContext(userId), mapId),
    getCardDesign(repoContext(userId)),
  ]);

  return { map, places, shapes, groups, cardDesign };
}
