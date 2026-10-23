import type { ReactNode } from "react";

import { HERO_PIN_COLORS } from "@/lib/marketing/hero-map";

import { PinMark } from "./pin-mark";
import type { StagePlace } from "./stage-data";
import { FACE_VIEWER } from "./step-stage";

/**
 * One of the editor's pins, standing on a `StepStage` ground.
 *
 * Three things on the ground — a soft shadow, a ripple ring (at rest invisible)
 * and the anchor — and the anchor turns back by the ground's own tilt and spin
 * (`FACE_VIEWER`), so the marker on it faces the viewer square while
 * perspective still makes the far ones smaller. The pin rides a short stem,
 * which is what makes it read as standing rather than painted on.
 *
 * The `data-*` hooks are what the drawings' sequences select by `index`:
 * `data-pin` lifts and drops, `data-shadow` and `data-ripple` play on the
 * ground, and `data-anchor` is a zero-size box whose screen position is the
 * pin's projected spot (the import drawing measures it). `above` stands on top
 * of the pin, facing the viewer with it — the design drawing's card.
 */
export function StagePin({
  place,
  index,
  marker,
  above,
}: {
  place: StagePlace;
  index: number;
  marker?: ReactNode;
  above?: ReactNode;
}) {
  const at = { left: `${place.left}%`, top: `${place.top}%` };
  const stem = place.kind === "flagship" ? 18 : 12;

  return (
    <>
      <span data-shadow={index} aria-hidden="true" className="mk-step-shadow" style={at} />
      <span
        data-ripple={index}
        aria-hidden="true"
        className="mk-step-ripple"
        style={{ ...at, borderColor: HERO_PIN_COLORS[place.kind], opacity: 0 }}
      />
      <div
        data-anchor={index}
        className="absolute size-0"
        style={{ ...at, transform: FACE_VIEWER, transformOrigin: "0 0" }}
      >
        <div
          data-pin={index}
          className="absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center"
        >
          {above}
          <span className="mk-step-pin">{marker ?? <PinMark kind={place.kind} />}</span>
          <span
            aria-hidden="true"
            className="-mt-2.5 w-0.5 rounded-full bg-foreground/35"
            style={{ height: stem }}
          />
        </div>
      </div>
    </>
  );
}
