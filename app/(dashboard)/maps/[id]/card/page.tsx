import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardDesigner } from "@/components/card/designer/card-designer";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/current-user";
import { getCardDesign } from "@/lib/repositories/card-design.repository";
import { repoContext } from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
import { loadMap } from "@/lib/repositories/load-map";
import { listAllPlaces } from "@/lib/repositories/places.repository";

export const metadata: Metadata = { title: "Card" };

export default async function MapCardPage(props: PageProps<"/maps/[id]/card">) {
  const { id } = await props.params;
  const user = await requireUser();

  // The try wraps only the fetch. JSX built inside a catch's scope isn't covered
  // by it — React renders children later, so the catch would never fire.
  let data: Awaited<ReturnType<typeof loadCard>>;

  try {
    data = await loadCard(user.id, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    // `content`, not `centered`: the canvas and its side panel want the width,
    // and the panel stacks under the card below `lg`.
    //
    // `flex flex-col` so the designer inside can claim the remaining height —
    // `Container` has none of its own, and the designer needs one definite
    // height to divide between the card's workspace and the sidebar. `min-h-0`
    // so it can also be squeezed rather than growing the page. Same pair as the
    // map editor's page, for the same reason.
    <Container className="flex min-h-0 flex-col">
      <CardDesigner
        map={data.map}
        initialPlaces={data.places}
        initialCardDesign={data.cardDesign}
      />
    </Container>
  );
}

async function loadCard(userId: string, mapId: string) {
  const ctx = repoContext(userId);

  /*
   * The locations come with the page, and are not optional.
   *
   * The card is drawn from a real one — an invented sample would show a card
   * that looks finished against data nobody has, and the first thing an owner
   * needs to know is what their card does when a location has no photo.
   *
   * The design itself is the account's, not this map's — see
   * lib/repositories/card-design.repository.ts — but this page still needs a
   * map to fetch its places from.
   */
  const [map, places, cardDesign] = await Promise.all([
    loadMap(userId, mapId),
    listAllPlaces(ctx, mapId),
    getCardDesign(ctx),
  ]);

  return { map, places, cardDesign };
}
