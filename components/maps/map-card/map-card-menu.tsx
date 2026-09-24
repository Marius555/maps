"use client";

import {
  ChartColumn,
  LayoutTemplate,
  MapIcon,
  MapPin,
  Pencil,
  Share2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RowMenu } from "@/components/ui/row-menu";
import { DeleteMapDialog } from "../delete-map-dialog";
import { RenameMapDialog } from "../rename-map-dialog";

/**
 * The map's sections, with the same names and icons the sidebar gives them once
 * the map is open (components/layout/sidebar/sidebar-map-nav.tsx), so an item
 * here and the page it lands on are recognisably the same thing.
 */
const SECTIONS: { id: string; label: string; icon: LucideIcon; path: string }[] = [
  { id: "map", label: "Map", icon: MapIcon, path: "" },
  { id: "places", label: "Locations", icon: MapPin, path: "/places" },
  { id: "card", label: "Card", icon: LayoutTemplate, path: "/card" },
  { id: "publish", label: "Publish", icon: Share2, path: "/publish" },
  { id: "analytics", label: "Analytics", icon: ChartColumn, path: "/analytics" },
];

/**
 * Every action a map card offers, behind one always-visible button.
 *
 * The card itself is the link to the editor; this is for everything else. The
 * old card revealed a Delete button on hover, which does not exist on a touch
 * screen and moved the eye every time the pointer crossed a card.
 */
export function MapCardMenu({ mapId, mapName }: { mapId: string; mapName: string }) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <>
      <RowMenu
        label={`Actions for ${mapName}`}
        items={[
          ...SECTIONS.map((section) => ({
            id: section.id,
            label: section.label,
            icon: section.icon,
            onAction: () => router.push(`/maps/${mapId}${section.path}`),
          })),
          {
            id: "rename",
            label: "Rename",
            icon: Pencil,
            onAction: () => setIsRenaming(true),
          },
          {
            id: "delete",
            label: "Delete map",
            icon: Trash2,
            isDanger: true,
            onAction: () => setIsDeleting(true),
          },
        ]}
      />

      <RenameMapDialog
        mapId={mapId}
        mapName={mapName}
        isOpen={isRenaming}
        onOpenChange={setIsRenaming}
      />

      <DeleteMapDialog
        mapId={mapId}
        mapName={mapName}
        isOpen={isDeleting}
        onOpenChange={setIsDeleting}
      />
    </>
  );
}
