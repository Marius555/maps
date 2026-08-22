"use client";

import { useRouter } from "next/navigation";

import { CategoryEditor } from "@/components/categories/category-editor";
import { CustomFieldEditor } from "@/components/fields/custom-field-editor";
import { DeleteMapButton } from "@/components/maps/delete-map-button";
import { TagGroupEditor } from "@/components/tags/tag-group-editor";
import { PageTitle } from "@/components/ui/page-title";
import { SectionPanel } from "@/components/ui/section-panel";
import { useMap } from "@/lib/query/maps";
import { usePlaces } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import { MapAppearanceSection } from "./map-appearance-section";
import { MapDetailsForm } from "./map-details-form";

/**
 * Client shell for the settings page.
 *
 * Reads the map from the query cache rather than props alone, so saving a name in
 * one section and editing categories in another never disagree about the map.
 *
 * Each block is a panel. Before, the sections were separated only by horizontal
 * rules, so the fields floated on the page background with nothing to belong to.
 */
export function MapSettings({
  initialMap,
  initialPlaces,
}: {
  initialMap: AppMap;
  initialPlaces: Place[];
}) {
  const router = useRouter();
  const { data: map = initialMap } = useMap(initialMap.id, initialMap);
  const { data: places = [] } = usePlaces(initialMap.id, initialPlaces);

  return (
    <div className="space-y-6">
      <PageTitle>Settings</PageTitle>

      <MapDetailsForm key={map.id} map={map} />

      <MapAppearanceSection map={map} />

      <CategoryEditor map={map} places={places} />

      {/* Under categories, in the order an owner builds a map: what a pin *is*,
          then how a visitor narrows the set, then what each card carries. */}
      <TagGroupEditor map={map} places={places} />

      <CustomFieldEditor map={map} places={places} />

      <SectionPanel
        title="Delete map"
        description="Removes the map and every location on it. If it's embedded anywhere, that embed stops working."
        // In the header rather than a footer: with no fields to fill in, a footer
        // would be a rule with a single button under an empty body.
        action={
          <DeleteMapButton
            mapId={map.id}
            mapName={map.name}
            onDeleted={() => router.push("/maps")}
          />
        }
      />
    </div>
  );
}
