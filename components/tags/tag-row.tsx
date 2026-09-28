"use client";

import { Button, Input, TextField } from "@heroui/react";
import { X } from "lucide-react";

import { SwatchButton } from "@/components/ui/swatch-button";
import type { MapTagGroup, Place } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { TagUsageMenu } from "./tag-usage-menu";

type MapTag = MapTagGroup["tags"][number];

/**
 * One tag in Tags & fields: its colour, its name, who wears it, and a way out.
 *
 * The colour is not decoration. A location's first tag is what colours its pin,
 * and a card whose Tags block uses tag colours draws the chip in it — so this
 * row is where a map's legend is written.
 */
export function TagRow({
  tag,
  autoFocus,
  wornBy,
  tagGroups,
  pinIcons,
  onChange,
  onRemove,
  onEditPlace,
}: {
  tag: MapTag;
  /** Focus the name on mount — the tag was just added. */
  autoFocus?: boolean;
  /** The locations wearing this tag, so removing one isn't a blind decision. */
  wornBy: readonly Place[];
  /** The draft vocabulary, which is what the listed pins are coloured from. */
  tagGroups: readonly MapTagGroup[];
  pinIcons: CustomPinIcon[];
  onChange: (patch: Partial<MapTag>) => void;
  onRemove: () => void;
  onEditPlace: (placeId: string) => void;
}) {
  const tagName = tag.label || "this tag";

  return (
    <li className="flex min-w-0 items-center gap-1.5">
      <SwatchButton
        label={`Colour for ${tagName}`}
        value={tag.color}
        onChange={(color) => onChange({ color })}
      />

      <TextField
        fullWidth
        autoFocus={autoFocus}
        aria-label="Tag name"
        value={tag.label}
        onChange={(label) => onChange({ label })}
        className="min-w-0 flex-1"
      >
        <Input placeholder="Tag name, e.g. Bikes" />
      </TextField>

      {/* Only when something wears it. A "0 locations" badge on every tag the
          owner is still typing is noise, not information. */}
      {wornBy.length > 0 ? (
        <TagUsageMenu
          tagName={tagName}
          places={wornBy}
          tagGroups={tagGroups}
          pinIcons={pinIcons}
          onEditPlace={onEditPlace}
        />
      ) : null}

      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`Remove ${tagName}`}
        onPress={onRemove}
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
    </li>
  );
}
