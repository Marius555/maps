"use client";

import {
  PropertyScale,
} from "@/components/ui/properties/property-fields";
import { PropertyNumberSelect } from "@/components/ui/properties/property-select";
import type { EmbedDesign } from "./use-embed-design";

/**
 * What the results panel is made of: how much of the map shows through it, how
 * blurred that is, and how round its corners are.
 *
 * **A fold of its own, and the condition is what earns it.** All three are read
 * only on a *floating* panel — opacity on a docked column reveals the page's own
 * background rather than the map, which is not what anybody reaches for it
 * wanting. So inside the Results panel fold they were three controls that
 * vanished the moment somebody chose "Beside it", leaving a gap where a third of
 * the fold had been, and three more rows pushing the panel's own switches off
 * the bottom of a 20rem column when they came back.
 *
 * `isEmpty` on the fold is what says it properly: with the panel docked or off
 * there is no heading either, because a trigger that opens onto nothing is worse
 * than no trigger. See `design-sidebar.tsx`, and `PropertyFold`'s own docblock
 * for why that has to be a prop rather than something worked out from children.
 *
 * These are the panel's answers and nothing else's — the toolbar's glass reads
 * the same three values rather than carrying any of its own, so what is being
 * designed here is one surface even though two things wear it.
 */
export function PanelSurfaceGroup({ settings, set }: EmbedDesign) {
  return (
    <div className="space-y-3">
      <PropertyNumberSelect
        label="Transparency"
        value={settings.panelOpacity}
        options={OPACITIES}
        onChange={(value) => set("panelOpacity", value)}
      />

      <PropertyScale
        label="Blur behind"
        value={settings.panelBlur}
        options={BLURS}
        onChange={(value) => set("panelBlur", value)}
      />

      <PropertyScale
        label="Corners"
        value={settings.panelRadius}
        options={RADII}
        onChange={(value) => set("panelRadius", value)}
      />
    </div>
  );
}

/* Stored as opacity but labelled as transparency, which is the way round
   somebody looking at a see-through panel describes it. */
const OPACITIES = [
  { value: 100, label: "Solid" },
  { value: 94, label: "Faint" },
  { value: 88, label: "Light" },
  { value: 76, label: "Clear" },
  { value: 60, label: "Glass" },
] as const;

/*
 * Three, not five. Blur is a background effect nobody is choosing 16px of, and
 * the two dropped stops sat either side of ones that were already there —
 * `nearestStop` lights the nearer tile for a map that stored one of them, and
 * writes nothing.
 */
const BLURS = [
  { value: 0, label: "None" },
  { value: 10, label: "Soft" },
  { value: 20, label: "Strong" },
] as const;

/**
 * Five corners, as tiles that draw their own corner.
 *
 * The same answer `RADIUS_STOPS` gives in the card designer, and the reason it
 * survives the cull to three elsewhere: a radius is hard to say with a word and
 * trivial to say with the thing itself, so the tile costs no label width at all.
 */
const RADII = [0, 6, 12, 18, 24].map((value, index, all) => ({
  value,
  label: ["Square", "Slight", "Regular", "Round", "Pill"][index] as string,
  icon: (
    <span
      aria-hidden="true"
      className="size-3.5 border-2 border-current"
      style={{ borderRadius: `${String((index / (all.length - 1)) * 7)}px` }}
    />
  ),
}));
