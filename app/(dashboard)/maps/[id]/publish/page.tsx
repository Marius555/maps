import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishPanel } from "@/components/publish/publish-panel";
import { Container, Measure } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/current-user";
import { repoContext } from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
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

  return (
    <Container>
      <Measure>
        <PublishPanel
          initialMap={data.map}
          initialPlaces={data.places}
          initialShapes={data.shapes}
        />
      </Measure>
    </Container>
  );
}

async function loadPublishData(userId: string, mapId: string) {
  // Places and shapes come along so the panel can tell the customer their
  // published map is behind the editor — neither kind of edit touches the map row.
  const [map, places, shapes] = await Promise.all([
    loadMap(userId, mapId),
    listAllPlaces(repoContext(userId), mapId),
    listAllShapes(repoContext(userId), mapId),
  ]);

  return { map, places, shapes };
}
