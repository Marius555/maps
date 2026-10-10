import { Reveal } from "@/components/marketing/reveal";
import { Section } from "@/components/marketing/section";
import { StepPanel } from "@/components/marketing/steps/step-panel";

import { ConnectArt } from "./art/connect-art";
import { InsertArt } from "./art/insert-art";
import { InstallArt } from "./art/install-art";

/**
 * The three steps, a drawing and one line each — the landing page's sequence
 * (`components/marketing/steps/steps.tsx`), told the same way: order says
 * "sequence", the drawings say what happens, and the detail is in the plugin's
 * readme for whoever wants it. The labels quoted are the ones WordPress and the
 * plugin draw.
 */
const STEPS = [
  {
    title: "Install the plugin",
    subtitle: "Plugins → Upload Plugin, choose the zip, press Activate.",
    art: <InstallArt />,
  },
  {
    title: "Add the map block",
    subtitle: "Add the Pinglide map block and press Set up this map.",
    art: <InsertArt />,
  },
  {
    title: "Pick a map",
    subtitle: "Log in, choose a map — and it’s on your page.",
    art: <ConnectArt />,
  },
];

export function WordPressSteps() {
  return (
    <Section
      eyebrow="Setup"
      title={
        <>
          On your page in <span className="text-accent">three steps</span>
        </>
      }
    >
      <ol className="grid gap-5 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Reveal delay={index * 0.06} className="h-full">
              <StepPanel title={step.title} subtitle={step.subtitle} art={step.art} />
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
