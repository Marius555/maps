"use client";

import { PinPreview } from "@/components/map/pin-preview";
import { CLUSTER_COLOR, clusterIconPin } from "@/packages/shared/clusters";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * One cluster as the map will draw it, so the choice is visible without zooming
 * out to find one.
 *
 * A picture of `showClusterIcon`'s layers (packages/shared/clusters.ts), not
 * the layers themselves: the icon, and the count in a badge at its top-right, at
 * the same 15px offset. With no icon it is the grey bubble with the count in the
 * middle, which is what the map keeps drawing.
 */
export function ClusterIconPreview({
  value,
  pinIcons,
}: {
  value: string;
  pinIcons: CustomPinIcon[];
}) {
  const pin = clusterIconPin(value, pinIcons);

  return (
    <div
      aria-hidden="true"
      className="flex h-20 items-center justify-center rounded-2xl bg-default/60"
    >
      {pin === null ? (
        <span
          className="flex size-10 items-center justify-center rounded-full border-2 border-white text-xs text-white"
          style={{ backgroundColor: CLUSTER_COLOR, opacity: 0.9 }}
        >
          12
        </span>
      ) : (
        <span className="relative flex size-11 items-center justify-center">
          {value.startsWith("data:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="size-9 rounded-full border-2 border-white object-cover shadow-sm"
            />
          ) : (
            <PinPreview
              icon={pin.icon}
              pinIcons={pinIcons}
              fallbackColor={CLUSTER_COLOR}
              size="fill"
            />
          )}

          <span
            className="absolute flex size-5 items-center justify-center rounded-full border-[1.5px] border-white text-[10px] text-white"
            style={{
              backgroundColor: CLUSTER_COLOR,
              left: "calc(50% + 15px)",
              top: "calc(50% - 15px)",
              transform: "translate(-50%, -50%)",
            }}
          >
            12
          </span>
        </span>
      )}
    </div>
  );
}
