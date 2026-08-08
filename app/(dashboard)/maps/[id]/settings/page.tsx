import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MapSettings } from "@/components/settings/map-settings";
import { Container, Measure } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/current-user";
import { repoContext } from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
import { loadMap } from "@/lib/repositories/load-map";
import { listAllPlaces } from "@/lib/repositories/places.repository";

export const metadata: Metadata = { title: "Settings" };

export default async function MapSettingsPage(
  props: PageProps<"/maps/[id]/settings">,
) {
  const { id } = await props.params;
  const user = await requireUser();

  // The try wraps only the fetch. JSX built inside a catch's scope isn't covered
  // by it — React renders children later, so the catch would never fire.
  let data: Awaited<ReturnType<typeof loadSettings>>;

  try {
    data = await loadSettings(user.id, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <Container>
      {/* Measure, not a narrow Container: the page keeps the same left edge as
          every other section so switching tabs doesn't shift content sideways. */}
      <Measure>
        <MapSettings initialMap={data.map} initialPlaces={data.places} />
      </Measure>
    </Container>
  );
}

async function loadSettings(userId: string, mapId: string) {
  // Places are needed to show how many locations use each category, so removing
  // one isn't a blind decision.
  const [map, places] = await Promise.all([
    loadMap(userId, mapId),
    listAllPlaces(repoContext(userId), mapId),
  ]);

  return { map, places };
}
