import type { CSSProperties } from "react";

import {
  HERO_PIN_COLORS,
  HERO_PIN_ICONS,
  projectPin,
  type HeroPin,
} from "@/lib/marketing/hero-map";
import { pinCssVars, pinSvg, resolvePin } from "@/packages/shared/pin-icons";

/** Seconds before the first pin lands, and between one pin and the next. */
const DROP_START_S = 0.25;
const DROP_STEP_S = 0.025;

/**
 * One pin on the hero's picture, as markup only.
 *
 * The editor's own marker, written as JSX: the same `map-pin` spans
 * `createPinElement` and `setPinIcon` build (components/map/pin-marker.ts), the
 * same SVG from `pinSvg`, and the same custom properties from `pinCssVars` — so
 * the pins on the landing page are the pins a customer places, not a drawing of
 * them. The generator at `/dev/hero-map` draws these too, which is why this has
 * no state and no motion of its own.
 *
 * `dropRank` turns on the landing: the pin drops in and the editor's own ripple
 * (`.map-pin__pulse`) plays as it lands, `rank` steps after the first. It is CSS,
 * not Motion, and that is the point — see `.mk-hero-pin__drop` in globals.css.
 *
 * `pinSvg` returns markup built from constants in packages/shared/pin-icons.ts,
 * never from input, which is what makes `dangerouslySetInnerHTML` safe here.
 */
export function HeroPinMarker({
  pin,
  selected = false,
  dropRank,
}: {
  pin: HeroPin;
  selected?: boolean;
  dropRank?: number;
}) {
  const icon =
    pin.kind === "cafe" ? null : resolvePin(`custom:${pin.kind}`, HERO_PIN_ICONS);
  const drops = dropRank !== undefined;

  const style = {
    ...pinCssVars(icon, undefined, HERO_PIN_COLORS[pin.kind]),
    ...(drops
      ? { "--mk-drop-delay": `${(DROP_START_S + dropRank * DROP_STEP_S).toFixed(3)}s` }
      : null),
  } as CSSProperties;

  const className = [
    "map-pin",
    icon ? "map-pin--icon" : "",
    selected ? "map-pin--selected" : "",
    drops ? "mk-hero-pin__drop" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span aria-hidden="true" className={className} style={style}>
      {icon ? (
        <span
          className="map-pin__shape"
          dangerouslySetInnerHTML={{ __html: pinSvg(icon) }}
        />
      ) : null}
      <span className="map-pin__dot" />
      {drops ? <span className="map-pin__pulse" /> : null}
    </span>
  );
}

/** Where a pin sits on the picture, as the `left`/`top` of its positioned box. */
export function heroPinPosition(pin: HeroPin): CSSProperties {
  const { x, y } = projectPin(pin);

  return { left: `${x.toFixed(3)}%`, top: `${y.toFixed(3)}%` };
}
