"use client";

import { Button } from "@heroui/react";
import { Code2, Globe } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { HeightCollapse } from "@/components/ui/height-collapse";
import type { StepState } from "@/lib/publish/steps";
import { WEBSITE_STEPS, type WebsiteStep } from "@/lib/publish/website-step";
import type { AppMap, Place } from "@/lib/repositories/types";
import { PublishAction } from "../publish-action";
import { ShareDialog } from "../share-dialog/share-dialog";
import { StepperHeading } from "../stepper/stepper-heading";
import { StepperStep } from "../stepper/stepper-step";
import { TextAction } from "../stepper/text-action";
import { useWebsiteSteps } from "./use-website-steps";

type Body = { title: string; bodyKey?: string; content?: ReactNode };

/**
 * The Publish footer outside the Shopify admin: the path onto the owner's own
 * site as three fixed steps — the twin of "Your store" (`StorefrontStepper`),
 * asked for by the owner on 2026-11-07 (docs/notes/publish-and-embed.md, "The
 * Your website stepper").
 *
 *   YOUR WEBSITE                                ● Live · 1 h ago
 *   ① Publish your map   ② Add it to your website   ③ Up to date
 *
 * Only the step the owner is on is open and has a filled button; finished
 * steps fold to a line with a check, later ones are grey. Nothing is added,
 * removed or renumbered (`websiteSteps`).
 *
 * - With edits before the snippet is marked, ② shows **Redeploy first** and
 *   then turns into **Get embed code** in the same place.
 * - ③ is the status: "Redeploy your changes" while the site is behind, "Up to
 *   date" once it is not. Under it, once ② is done, **Get embed code** as an
 *   accent text link, in both states, so it never comes and goes.
 *
 * Get embed code opens `ShareDialog`, the embed code and allowed sites
 * together. A successful Copy embed code there, or "Already added" here, marks
 * ② done.
 *
 * **While a designer fold is open, the steps fold away** under the heading,
 * which is then the way back (`isCollapsed` / `onExpand`, from `DesignSidebar`).
 */
export function WebsiteStepper({
  map,
  places,
  hasPendingChanges,
  isCollapsed = false,
  onExpand,
}: {
  map: AppMap;
  places: Place[];
  hasPendingChanges: boolean;
  /** A designer fold is open: only the heading row shows. */
  isCollapsed?: boolean;
  /** Bring the steps back — closes the open fold. */
  onExpand?: () => void;
}) {
  const published = Boolean(map.publishedAt);
  const { steps, primary, markEmbedAdded } = useWebsiteSteps(map.id, {
    published,
    hasPendingChanges,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const titleId = useId();
  const openDialog = () => setIsDialogOpen(true);

  const body = (id: WebsiteStep, state: StepState): Body => {
    switch (id) {
      case "publish":
        return state === "current"
          ? {
              title: "Publish your map",
              bodyKey: "publish",
              content: <PublishAction mapId={map.id} />,
            }
          : { title: "Publish your map" };

      case "embed":
        if (state !== "current") return { title: "Add it to your website" };
        return primary === "redeploy"
          ? {
              title: "Add it to your website",
              bodyKey: "redeploy-first",
              content: (
                <>
                  <p className="text-xs text-pretty text-muted">
                    Your latest changes aren&rsquo;t live yet. Redeploy first, then add
                    the code.
                  </p>
                  <PublishAction mapId={map.id} redeploy />
                  <TextAction onPress={markEmbedAdded}>Already added</TextAction>
                </>
              ),
            }
          : {
              title: "Add it to your website",
              bodyKey: "embed",
              content: (
                <>
                  <p className="text-xs text-pretty text-muted">
                    Paste one line of code where the map should appear. On WordPress,
                    use the plugin instead.
                  </p>
                  <Button variant="primary" size="sm" className="w-full" onPress={openDialog}>
                    Get embed code
                  </Button>
                  <TextAction onPress={markEmbedAdded}>Already added</TextAction>
                </>
              ),
            };

      case "live": {
        const link = (
          <TextAction tone="accent" icon={Code2} onPress={openDialog}>
            Get embed code
          </TextAction>
        );

        if (state === "current") {
          return {
            // A viewer is here too, with no Redeploy of their own to press.
            title: primary === "redeploy" ? "Redeploy your changes" : "Changes not live yet",
            bodyKey: "redeploy",
            content: (
              <>
                <p className="text-xs text-pretty text-muted">
                  Your site still shows the version you last published.
                </p>
                <PublishAction mapId={map.id} redeploy />
                {link}
              </>
            ),
          };
        }

        return state === "done"
          ? {
              title: "Up to date",
              bodyKey: "up-to-date",
              content: (
                <>
                  <p className="text-xs text-pretty text-muted">
                    Your site shows your latest changes.
                  </p>
                  {link}
                </>
              ),
            }
          : { title: "Up to date" };
      }
    }
  };

  return (
    <section aria-labelledby={titleId}>
      <StepperHeading
        id={titleId}
        icon={Globe}
        title="Your website"
        map={map}
        hasPendingChanges={hasPendingChanges}
        onExpand={isCollapsed ? onExpand : undefined}
      />

      <HeightCollapse isCollapsed={isCollapsed} className="pt-3">
        <ol aria-busy={steps === null || undefined}>
          {WEBSITE_STEPS.map((id, index) => {
            const state = steps?.[id] ?? "upcoming";
            const { title, bodyKey, content } = body(id, state);
            return (
              <StepperStep
                key={id}
                number={index + 1}
                state={state}
                isLoading={steps === null}
                title={title}
                isLast={index === WEBSITE_STEPS.length - 1}
                bodyKey={steps === null ? undefined : bodyKey}
              >
                {content}
              </StepperStep>
            );
          })}
        </ol>
      </HeightCollapse>

      <ShareDialog
        map={map}
        places={places}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSnippetCopied={markEmbedAdded}
      />
    </section>
  );
}
