"use client";

import { Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import type { CSSProperties } from "react";

import { Carousel } from "@/components/ui/carousel";
import { IconButton } from "@/components/ui/icon-button";
import { PickedCheck, pickedTileClass } from "@/components/ui/picked-tile";
import {
  PIN_ICONS,
  pinSvg,
  resolvePin,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";

/**
 * What goes inside the pin: one of the built-in glyphs, or an uploaded logo.
 *
 * A pin is an icon *or* an image, never both — `pinIconSchema` refuses anything
 * else — and the field says so by swapping outright rather than by dimming.
 * Uploading replaces the glyph carousel with the pin itself at full size, which
 * is both the confirmation that the upload worked and the honest answer to "what
 * will this look like": a logo shrunk into a 24px pin is the only thing worth
 * previewing here, and the glyphs beneath it would just be noise you cannot press.
 *
 * The upload button itself lives in the builder's footer. What stays here is the
 * way *back* — "Use an icon instead" is a mode switch for this field, and it only
 * exists while there is an image to switch away from.
 *
 * Delete sits in this section's title row rather than in the footer, where it had
 * the same weight as Save. A trash icon, because the row is a label and a control,
 * not a place for a second sentence.
 *
 * The glyph previews carry the draft's own colour, so choosing a shape and
 * choosing a colour are visibly the same pin rather than two unrelated settings.
 */
export function PinIconField({
  draft,
  usageCount,
  isExisting,
  onChange,
  onImageChange,
  onDelete,
}: {
  draft: CustomPinIcon;
  /** Locations wearing this pin, so deleting it isn't a blind decision. */
  usageCount: number;
  isExisting: boolean;
  onChange: (draft: CustomPinIcon) => void;
  /** Owned by the builder, since the upload button that also calls it is there. */
  onImageChange: (image: string) => void;
  onDelete: () => void;
}) {
  const hasImage = Boolean(draft.image);

  // The same resolver the marker uses, so this is the drawing that lands.
  const pin = resolvePin("custom:preview", [{ ...draft, id: "preview" }]);

  // The consequence rides in the label, so the tooltip and the accessible name
  // both carry it rather than it needing a line of its own under the button.
  const trash = isExisting ? (
    <IconButton
      label={deleteLabel(usageCount)}
      icon={Trash2}
      variant="ghost"
      onPress={onDelete}
    />
  ) : null;

  if (hasImage) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <span className="text-sm font-medium">Icon</span>
          {trash}
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border p-4">
          <span
            aria-hidden="true"
            className="pin-preview pin-preview--xl shrink-0"
            style={{ "--pin-color": draft.color } as CSSProperties}
            dangerouslySetInnerHTML={{ __html: pinSvg(pin) }}
          />
          <Button size="sm" variant="tertiary" onPress={() => onImageChange("")}>
            Use an icon instead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Carousel title="Icon" count={PIN_ICONS.length} action={trash}>
      {PIN_ICONS.map((icon) => {
        const isPicked = draft.glyph === icon.id;

        return (
          <li key={icon.id}>
            <button
              type="button"
              title={icon.label}
              aria-label={icon.label}
              aria-pressed={isPicked}
              onClick={() => onChange({ ...draft, glyph: icon.id, image: "" })}
              className={`${pickedTileClass(isPicked)} flex w-full items-center justify-center p-2`}
            >
              {isPicked ? <PickedCheck /> : null}

              <span
                aria-hidden="true"
                className="pin-preview pin-preview--lg"
                style={{ "--pin-color": draft.color } as CSSProperties}
                dangerouslySetInnerHTML={{ __html: pinSvg(resolvePin(icon.id)) }}
              />
            </button>
          </li>
        );
      })}
    </Carousel>
  );
}

function deleteLabel(usageCount: number): string {
  if (usageCount === 0) return "Delete pin";

  const places = usageCount === 1 ? "1 location" : `${usageCount} locations`;
  return `Delete pin — ${places} will go back to a plain pin`;
}
