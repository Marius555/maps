"use client";

import { Button } from "@heroui/react";
import { Tags } from "lucide-react";
import { useState } from "react";

import type { AppMap, Place } from "@/lib/repositories/types";
import { VocabularyDialog } from "./vocabulary-dialog";

/** Opens the map's tags and extra fields — see VocabularyDialog. */
export function VocabularyButton({
  map,
  places,
  onEditPlace,
}: {
  map: AppMap;
  places: Place[];
  onEditPlace: (placeId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onPress={() => setIsOpen(true)}>
        <Tags aria-hidden="true" className="size-4" />
        Tags &amp; fields
      </Button>

      <VocabularyDialog
        map={map}
        places={places}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onEditPlace={onEditPlace}
      />
    </>
  );
}
