import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ImportWizard } from "@/components/places/import/import-wizard";
import { Container, Measure } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { NotFoundError } from "@/lib/repositories/errors";
import { loadMap } from "@/lib/repositories/load-map";
import type { AppMap } from "@/lib/repositories/types";

export const metadata: Metadata = { title: "Import locations" };

export default async function ImportPage(
  props: PageProps<"/maps/[id]/places/import">,
) {
  const { id } = await props.params;
  const user = await requireUser();

  // The try wraps only the fetch — see the settings page for why.
  let map: AppMap;

  try {
    map = await loadMap(user.id, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <Container>
      <Measure className="space-y-6">
        <PageHeader
          title="Import locations"
          description="Bring in a CSV of your locations. You'll confirm everything before it's saved."
        />

        <ImportWizard map={map} />
      </Measure>
    </Container>
  );
}
