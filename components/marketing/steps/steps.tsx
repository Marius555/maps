import { Reveal } from "../reveal";
import { Section } from "../section";
import { DesignArt } from "./art/design-art";
import { ImportArt } from "./art/import-art";
import { PublishArt } from "./art/publish-art";
import { StepPanel } from "./step-panel";

/**
 * How a map gets made.
 *
 * **A sequence, told by order rather than by numerals.** There is nothing to
 * design until the locations are in, and nothing to publish until it has been
 * designed — and three panels read left to right already say that. The "01, 02,
 * 03" they used to wear said it a second time, louder than the drawings.
 *
 * Each drawing plays its step on a loop while it is on screen (useArtLoop), in
 * the page's neutrals and the accent only.
 *
 * **A picture and one line each.** The cards this replaced carried two
 * paragraphs apiece and no image, which is a wall of text in three columns; the
 * detail they held lives in the documentation, where somebody who wants it is
 * already looking.
 */
const STEPS = [
  {
    title: "Drop in a spreadsheet",
    // lib/import/**
    subtitle: "CSV, Excel, XML or a Google Sheet. Every address becomes a pin.",
    art: <ImportArt />,
  },
  {
    title: "Make it look like yours",
    // lib/map/style.ts, components/tags/**, components/card/**
    subtitle: "Pick a basemap, colour the pins, lay out the card.",
    art: <DesignArt />,
  },
  {
    title: "Paste one line",
    // lib/snapshot/storage.ts, lib/embed/snippet.ts
    subtitle: "Works on Webflow, WordPress, Shopify and plain HTML.",
    art: <PublishArt />,
  },
];

export function Steps() {
  return (
    <Section
      screen
      eyebrow="Sequence"
      title="Three steps, and none of them is “ask a developer”."
      lede="A spreadsheet, an afternoon of choices, and a paste."
    >
      <ol className="grid gap-5 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Reveal delay={index * 0.06} className="h-full">
              <StepPanel
                title={step.title}
                subtitle={step.subtitle}
                art={step.art}
              />
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
