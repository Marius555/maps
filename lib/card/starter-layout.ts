import {
  defaultCardLayout,
  resolveCardLayout,
  type CardLayout,
} from "@/packages/shared/card-layout";

/**
 * The card an account draws and publishes until it saves a design of its own.
 *
 * **Not `defaultCardLayout()`, and that one must not be edited into this.** The
 * default is the published contract: `buildSnapshot` omits a layout equal to it,
 * and the embed then draws *its own bundled copy* (`embed/src/map.ts`). Changing
 * it would redesign every map already live for an account that never opened the
 * designer the next time the embed deploys, and a visitor's cached older
 * `map.js` would draw a different card from a fresh one. This layout is not
 * equal to the default, so `cardLayoutField` writes it into the snapshot
 * explicitly and the embed draws exactly what was published.
 *
 * Here rather than in `packages/shared` because the embed must not inherit it —
 * it never needs it, and every byte there is paid on every visitor's download.
 *
 * Every number is one of the designer's own tiles, so the panel lights a choice
 * rather than nothing (property-scales.tsx):
 * - width 220 = Card width **XS**, maxHeight 300 = Card height **S**;
 * - photo 33% = a third of the card;
 * - logo 27% = Size **L** (`heightStops(14, 40)`), at the right, straddling the
 *   photo's bottom edge by half — the overlap a freshly dropped logo arrives with;
 * - button radius 28 = the **Pill** preset, inner padding 6 = **Regular**, and
 *   Spacing → Margin **None** (0, where absent would be the card's 12px) and
 *   Padding **Tight** (4).
 *
 * Every block sits in a zone its spec allows and none carries an `offset`, so
 * the card holds no stored free space and the designer offers only the standard
 * drop targets. Fixed ids, as `defaultCardLayout()` uses. Run through
 * `resolveCardLayout` so the bytes are the canonical ones the designer's own
 * `sameCardLayout` comparison produces.
 */
export function starterCardLayout(): CardLayout {
  return resolveCardLayout({
    ...defaultCardLayout(),
    width: 220,
    maxHeight: 300,
    zones: {
      top: [
        { id: "gallery", type: "gallery", heightPct: 33 },
        {
          id: "logo",
          type: "logo",
          heightPct: 27,
          align: "end",
          overlapPct: 50,
          logoMode: "mixed",
        },
      ],
      middle: [{ id: "address", type: "address", padding: 4 }],
      bottom: [
        {
          id: "button",
          type: "button",
          margin: 0,
          padding: 4,
          buttonFull: true,
          buttonVariant: "solid",
          buttonRadius: 28,
          buttonPadding: 6,
        },
      ],
    },
  });
}
