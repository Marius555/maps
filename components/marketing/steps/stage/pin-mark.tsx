import type { CSSProperties } from "react";

import { HERO_PIN_COLORS, HERO_PIN_ICONS, type HeroPinKind } from "@/lib/marketing/hero-map";
import { pinCssVars, pinSvg, resolvePin } from "@/packages/shared/pin-icons";

/**
 * The editor's own marker, as `HeroPinMarker` draws it (the same `map-pin`
 * spans, `pinSvg` and `pinCssVars`), with one addition the design drawing
 * needs: a colour that beats the kind's, the way a group's colour does in the
 * product.
 *
 * `pinSvg` returns markup built from constants in packages/shared/pin-icons.ts,
 * never from input, which is what makes `dangerouslySetInnerHTML` safe here.
 */
export function PinMark({ kind, color }: { kind: HeroPinKind; color?: string }) {
  const icon = kind === "cafe" ? null : resolvePin(`custom:${kind}`, HERO_PIN_ICONS);
  const style = pinCssVars(icon, color, HERO_PIN_COLORS[kind]) as CSSProperties;

  return (
    <span aria-hidden="true" className={`map-pin ${icon ? "map-pin--icon" : ""}`} style={style}>
      {icon ? (
        <span className="map-pin__shape" dangerouslySetInnerHTML={{ __html: pinSvg(icon) }} />
      ) : null}
      <span className="map-pin__dot" />
    </span>
  );
}
