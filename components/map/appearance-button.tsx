"use client";

import { Button, Popover } from "@heroui/react";
import { Palette } from "lucide-react";
import { useState } from "react";

import { AppearancePanel } from "@/components/appearance/appearance-panel";
import type { MapStyleKey } from "@/lib/map/style";
import type { MapAppearanceSettings } from "@/lib/validation/map-appearance.schema";

/**
 * How the map looks, one click from the map.
 *
 * The same controls live on the Settings tab, and that is where they used to
 * only live — which meant changing a basemap was: leave the editor, change it,
 * come back, look. Restyling is a thing you do by eye, so it belongs where the
 * eye already is.
 *
 * On the right of the toolbar's rule, with Save this view and Preview. The rule
 * separates tools that change what a gesture *means* from things you do *to* the
 * map, and repainting the basemap is squarely the second.
 *
 * Icon-only, like both of its neighbours: the row already competes with the
 * search field on a phone, and a fourth label is what pushes it over.
 *
 * Every change saves immediately — there is no Save button in here. A theme is a
 * thing you try, and a picker that makes you confirm each attempt is a picker
 * you stop trying things in. The mutation is optimistic (lib/query/maps.ts), so
 * the canvas repaints in the same frame the swatch is pressed.
 */
export function AppearanceButton({
  style,
  appearance,
  onChangeStyle,
  onChangeAppearance,
}: {
  style: MapStyleKey;
  appearance: MapAppearanceSettings;
  onChangeStyle: (style: MapStyleKey) => void;
  onChangeAppearance: (appearance: MapAppearanceSettings) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      {/*
       * A plain Button with an aria-label rather than the repo's IconButton:
       * that one wraps its trigger in a Tooltip, and a tooltip on a popover
       * trigger stays up over the panel it just opened.
       */}
      <Button size="sm" variant="tertiary" isIconOnly aria-label="Map appearance">
        <Palette aria-hidden="true" className="size-4" />
      </Button>

      <Popover.Content placement="bottom end">
        <Popover.Dialog aria-label="Map appearance">
          {/*
           * Capped in both directions. The width is the widest a phone can give
           * without the popover clipping; the height stops a panel with sixteen
           * swatches and six switches from running off the bottom of a laptop.
           */}
          <div className="max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain p-0.5">
            <AppearancePanel
              style={style}
              appearance={appearance}
              onChangeStyle={onChangeStyle}
              onChangeAppearance={onChangeAppearance}
            />
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
