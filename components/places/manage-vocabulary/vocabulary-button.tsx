"use client";

import { Button } from "@heroui/react";
import { Tags } from "lucide-react";
import { useState } from "react";

import type { AppMap, Place } from "@/lib/repositories/types";
import { VocabularyDialog } from "./vocabulary-dialog";

/** Opens the map's filter groups and extra fields — see VocabularyDialog. */
export function VocabularyButton({ map, places }: { map: AppMap; places: Place[] }) {
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
      />
    </>
  );
}
