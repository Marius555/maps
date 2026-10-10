import { CodeBlock } from "@/components/marketing/integrations/code-block";
import { Section } from "@/components/marketing/section";
import { embedSnippet } from "@/lib/embed/snippet";

/**
 * Where the published embed lives (CLAUDE.md, Environment). Display only: the
 * snippet below shows the code's shape, and its snapshot is a placeholder.
 */
const SCRIPT_URL =
  process.env.NEXT_PUBLIC_EMBED_SCRIPT_URL || "https://cdn.pinglide.com/embed/v1/map.js";

/** The snippet a publish hands out, built by the same function, minus a real map. */
const EXAMPLE = embedSnippet({ scriptUrl: SCRIPT_URL, snapshotUrl: "YOUR-MAP-URL" });

const STEPS = [
  { title: "Publish your map", body: "Press Publish on the map’s Publish tab." },
  { title: "Copy the embed code", body: "Embed code and domains → Copy embed code." },
  { title: "Paste it into your page", body: "Use your builder’s HTML, Code or Embed block." },
] as const;

/**
 * The how, in three lines beside the code itself. The example is the real
 * snippet's shape (`embedSnippet`, lib/embed/snippet.ts) with a placeholder for
 * the map — it says so under the block, so nobody pastes it expecting a map.
 */
export function AnyWebsiteCode() {
  return (
    <Section
      eyebrow="Setup"
      title={
        <>
          Copy, paste, <span className="text-accent">done</span>
        </>
      }
    >
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
        <ol className="space-y-6">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold tabular-nums text-accent-foreground"
              >
                {index + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-pretty text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="min-w-0">
          <CodeBlock code={EXAMPLE} label="HTML" />
          <p className="mt-3 text-sm text-muted">
            Your map’s own code, ready to paste, is under Publish → Embed code and domains.
          </p>
        </div>
      </div>
    </Section>
  );
}
