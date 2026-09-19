import { Info } from "lucide-react";

import { ATTRIBUTION_HTML } from "@/lib/map/style";
import { HERO_ROUTE_CREDIT } from "@/lib/marketing/hero-routes";

/**
 * The tile credit, plus the engine that measured the baked route when there is
 * one. Geoapify's free plan requires the second (CLAUDE.md §12) and this page
 * publishes a route drawn on it; both halves are constants from our own
 * modules, never input.
 */
const CREDIT_HTML = HERO_ROUTE_CREDIT
  ? `${ATTRIBUTION_HTML} · ${HERO_ROUTE_CREDIT}`
  : ATTRIBUTION_HTML;

/**
 * The map's credit (CLAUDE.md §12), folded behind an ⓘ the way every other map
 * in the app folds it (packages/shared/attribution.ts).
 *
 * A native `<details>`, which is what MapLibre's own compact control is too: it
 * opens with no script at all, so the credit is one press away even on a page
 * whose JavaScript never ran. It starts closed, and opening it plays a short CSS
 * entrance (`.mk-hero-attrib` in globals.css).
 *
 * On the frame rather than baked into the picture, because the frame crops the
 * picture and a credit in its corner would be the first thing cut on a phone.
 */
export function HeroAttribution() {
  return (
    <details className="mk-hero-attrib">
      <summary aria-label="Map credits" className="mk-hero-attrib__button">
        <Info aria-hidden="true" className="size-3.5" />
      </summary>

      <p
        className="mk-hero-attrib__text"
        dangerouslySetInnerHTML={{ __html: CREDIT_HTML }}
      />
    </details>
  );
}
