"use client";

import { PinTile } from "@/components/map/pin-tile";
import { CarouselSection } from "@/components/ui/carousel-section";
import { pickedTileClass } from "@/components/ui/picked-tile";
import { CLUSTER_COLOR } from "@/packages/shared/clusters";
import {
  CUSTOM_PIN_PREFIX,
  PIN_ICONS,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";

/**
 * Choose what a cluster is drawn as: the grey bubble, one of the pins, or an
 * uploaded image.
 *
 * Two one-line carousels, the same `CarouselSection` panels the pin library
 * uses, so the two dialogs that lay out the same pins look alike. A wrapping grid
 * of every pin at once was what this used to be, and at a dozen 56px tiles it was
 * the densest thing in the editor.
 *
 * The first row is the map's own: the bubble (the default), an uploaded image
 * when there is one, then the pins somebody made on purpose. The built-ins come
 * second, drawn in the cluster's neutral grey — the colour the map will use.
 *
 * Pins are `PinTile`s at `lg`, the library's own tile. The bubble and the image
 * are not pins, so they get `ChoiceTile`, cut to the same size so the row keeps
 * one height.
 *
 * Uploading is not here. It is in the dialog's footer, beside Done — see
 * ClusterIconDialog.
 */
export function ClusterIconPicker({
  value,
  pinIcons,
  onChange,
}: {
  /** `AppMap.clusterIcon`: "" for the bubble, a pin id, or a data URI. */
  value: string;
  pinIcons: CustomPinIcon[];
  onChange: (next: string) => void;
}) {
  const image = value.startsWith("data:") ? value : "";
  const ownCount = 1 + (image ? 1 : 0) + pinIcons.length;

  return (
    <div role="group" aria-label="Cluster icon" className="flex flex-col gap-3">
      <CarouselSection
        title="Your icons"
        hint="The default bubble, your image and your pins"
        count={ownCount}
        badge={null}
      >
        <li>
          <ChoiceTile
            label="Bubble"
            title="Grey bubble (default)"
            isPicked={value === ""}
            onPress={() => onChange("")}
          >
            <span
              aria-hidden="true"
              className="size-3/5 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: CLUSTER_COLOR }}
            />
          </ChoiceTile>
        </li>

        {image ? (
          <li>
            <ChoiceTile label="Image" title="Your uploaded image" isPicked onPress={() => {}}>
              {/* A data URI already in memory, so next/image has nothing to do. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="size-4/5 rounded-full object-cover" />
            </ChoiceTile>
          </li>
        ) : null}

        {pinIcons.map((pin) => {
          const icon = `${CUSTOM_PIN_PREFIX}${pin.id}`;

          return (
            <li key={icon}>
              <PinTile
                icon={icon}
                pinIcons={pinIcons}
                size="lg"
                isArmed={value === icon}
                onPress={() => onChange(icon)}
              />
            </li>
          );
        })}
      </CarouselSection>

      <CarouselSection
        title="Built in"
        hint="Drawn in the cluster grey"
        count={PIN_ICONS.length}
        badge={null}
      >
        {PIN_ICONS.map((pin) => (
          <li key={pin.id}>
            <PinTile
              icon={pin.id}
              pinIcons={pinIcons}
              fallbackColor={CLUSTER_COLOR}
              size="lg"
              isArmed={value === pin.id}
              onPress={() => onChange(pin.id)}
            />
          </li>
        ))}
      </CarouselSection>
    </div>
  );
}

/**
 * A choice that is not a pin, shaped like `PinTile` at `lg` — the same padding,
 * a square preview box capped at the pin preview's 3.5rem, and the caption under
 * it — so it sits in a row of pins without changing the row's height.
 */
function ChoiceTile({
  label,
  title,
  isPicked,
  onPress,
  children,
}: {
  label: string;
  title: string;
  isPicked: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={isPicked}
      onClick={onPress}
      className={`${pickedTileClass(isPicked)} flex w-full flex-col items-center gap-1.5 p-2 text-center`}
    >
      <span
        aria-hidden="true"
        className="flex aspect-square w-full max-w-14 items-center justify-center"
      >
        {children}
      </span>
      <span aria-hidden="true" className="w-full truncate text-xs leading-tight text-muted">
        {label}
      </span>
    </button>
  );
}
