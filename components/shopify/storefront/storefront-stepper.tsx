"use client";

import { Button, Spinner } from "@heroui/react";
import { ExternalLink, Store } from "lucide-react";
import { useId, type ReactNode } from "react";

import { PublishAction } from "@/components/publish/publish-action";
import { ShareDialog } from "@/components/publish/share-dialog/share-dialog";
import { StepperHeading } from "@/components/publish/stepper/stepper-heading";
import { StepperStep } from "@/components/publish/stepper/stepper-step";
import { TextAction } from "@/components/publish/stepper/text-action";
import { HeightCollapse } from "@/components/ui/height-collapse";
import type { StepState } from "@/lib/publish/steps";
import type { AppMap, Place } from "@/lib/repositories/types";
import { pickerName } from "@/lib/shopify/storefront-maps";
import { STOREFRONT_STEPS, type StorefrontStep } from "@/lib/shopify/storefront-step";
import { DomainMissing } from "./domain-missing";
import type { useStorefront } from "./use-storefront";

type Body = { title: string; action?: ReactNode; bodyKey?: string; content?: ReactNode };

/**
 * The Publish footer inside the Shopify admin: the whole path onto the store
 * as three fixed steps (docs/notes/shopify.md, "The Publish footer inside
 * Shopify"). Its twin outside Shopify is `WebsiteStepper`.
 *
 *   YOUR STORE                                  ● Live · 1 h ago
 *   ① Show on your storefront   ② Add the block to your theme   ③ Up to date
 *
 * Only the step the merchant is on is open and has a filled button; finished
 * steps fold to a line with a check, later ones are grey. Nothing is added,
 * removed or renumbered (`storefrontSteps`) — the owner read a list that
 * reshuffled under them as a flow going nowhere (2026-11-07).
 *
 * - With edits before the theme is marked, ② shows **Redeploy first** and then
 *   turns into **Add to theme** in the same place: the two are never offered
 *   together, and with edits Redeploy wins.
 * - ③ is the status: "Redeploy your changes" while the store is behind, "Up to
 *   date" once it is not. Under it, once ② is done, **Open theme editor** as an
 *   accent text link in both states, where a full-width Go to theme used to be.
 * - While the storefront status loads, the same three steps with pulsing discs
 *   and "Checking your storefront…" under ① — the list that loads is the list
 *   that stays, and only the bodies arrive.
 *
 * Everything that is not the next step is words, not a button: Remove, Make
 * default, Already added, Embed on another site.
 */
export function StorefrontStepper({
  map,
  places,
  hasPendingChanges,
  storefront,
  isCollapsed = false,
  onExpand,
}: {
  map: AppMap;
  places: Place[];
  hasPendingChanges: boolean;
  storefront: ReturnType<typeof useStorefront>;
  /** A designer fold is open: only the heading row shows (`DesignSidebar`). */
  isCollapsed?: boolean;
  /** Bring the steps back — closes the open fold. */
  onExpand?: () => void;
}) {
  const {
    status,
    steps,
    primary,
    quietRedeploy,
    onShow,
    onRemove,
    onFixDomain,
    onAddToTheme,
    onGoToTheme,
    onAlreadyAdded,
    isShowing,
    busy,
  } = storefront;
  const current = status.data;
  const published = Boolean(map.publishedAt);
  const isLoading = steps === null && !status.isError;
  const titleId = useId();

  const redeploy = (
    <PublishAction mapId={map.id} redeploy={published} onStorefront={current?.onStorefront === true} />
  );

  const body = (id: StorefrontStep, state: StepState): Body => {
    switch (id) {
      case "show": {
        const title = "Show on your storefront";

        if (steps === null) {
          return status.isError
            ? {
                title,
                bodyKey: "error",
                content: (
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    Couldn&rsquo;t check your storefront.
                    <TextAction onPress={() => void status.refetch()}>Try again</TextAction>
                  </p>
                ),
              }
            : {
                title,
                bodyKey: "checking",
                content: (
                  <p className="flex items-center gap-2 text-xs text-muted" role="status">
                    <Spinner size="sm" aria-hidden="true" />
                    Checking your storefront…
                  </p>
                ),
              };
        }

        if (state === "current") {
          return {
            title,
            bodyKey: "show",
            content: (
              <>
                <p className="text-xs text-pretty text-muted">
                  Makes this map available to the Pinglide block in your theme.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  isPending={isShowing}
                  onPress={() => onShow(false)}
                >
                  Show on storefront
                </Button>
              </>
            ),
          };
        }

        const notDefault = current !== undefined && !current.isDefault;
        const domainMissing = current?.domainMissing === true;
        return {
          title,
          action: (
            <TextAction tone="danger" isDisabled={busy} onPress={onRemove}>
              Remove
            </TextAction>
          ),
          bodyKey: notDefault || domainMissing ? "done" : undefined,
          content: (
            <>
              {notDefault ? (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  Not your default map.
                  <TextAction isDisabled={busy} onPress={() => onShow(true)}>
                    Make default
                  </TextAction>
                </p>
              ) : null}
              {domainMissing && current ? (
                <DomainMissing
                  storeHost={current.storeHost}
                  isDisabled={busy}
                  isPending={isShowing}
                  onFix={onFixDomain}
                />
              ) : null}
            </>
          ),
        };
      }

      case "theme": {
        const title = "Add the block to your theme";
        if (state !== "current" || current === undefined) return { title };

        return primary === "redeploy"
          ? {
              title,
              bodyKey: "redeploy-first",
              content: (
                <>
                  <p className="text-xs text-pretty text-muted">
                    {published
                      ? "Your latest changes aren’t live yet. Redeploy first, so your theme shows them."
                      : "Publish first, so your theme has a map to show."}
                  </p>
                  {redeploy}
                  <TextAction onPress={onAlreadyAdded}>Already added</TextAction>
                </>
              ),
            }
          : {
              title,
              bodyKey: "add",
              content: (
                <>
                  <p className="text-xs text-pretty text-muted">
                    {current.isDefault
                      ? "Opens your theme editor with the block added. Press Save there."
                      : `Opens your theme editor with a block added. Choose “${pickerName(current.name)}” under Map, then press Save.`}
                  </p>
                  <Button variant="primary" size="sm" className="w-full" onPress={onAddToTheme}>
                    Add to theme
                  </Button>
                  <TextAction onPress={onAlreadyAdded}>Already added</TextAction>
                </>
              ),
            };
      }

      case "live": {
        const link = (
          <TextAction tone="accent" icon={ExternalLink} onPress={onGoToTheme}>
            Open theme editor
          </TextAction>
        );

        // No answer about the storefront: Redeploy is still something the
        // merchant can do, when there is anything to redeploy.
        if (steps === null) {
          return primary === "redeploy"
            ? { title: "Redeploy your changes", bodyKey: "fallback", content: redeploy }
            : { title: "Up to date" };
        }

        if (state === "current") {
          return {
            title: published ? "Redeploy your changes" : "Publish your map",
            bodyKey: "redeploy",
            content: (
              <>
                <p className="text-xs text-pretty text-muted">
                  Your store still shows the version you last published.
                </p>
                {redeploy}
                {link}
              </>
            ),
          };
        }

        if (state === "done") {
          return {
            title: "Up to date",
            bodyKey: "up-to-date",
            content: (
              <>
                <p className="text-xs text-pretty text-muted">
                  Your store shows your latest changes.
                </p>
                {link}
              </>
            ),
          };
        }

        // Off the storefront with edits: never stuck with them, and never a
        // second filled button beside Show on storefront.
        return quietRedeploy
          ? {
              title: "Up to date",
              bodyKey: "quiet",
              content: (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  Edits not live yet.
                  <PublishAction mapId={map.id} redeploy look="text" />
                </p>
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
        icon={Store}
        title="Your store"
        map={map}
        hasPendingChanges={hasPendingChanges}
        onExpand={isCollapsed ? onExpand : undefined}
      />

      <HeightCollapse isCollapsed={isCollapsed} className="space-y-3 pt-3">
        <ol aria-busy={isLoading || undefined}>
          {STOREFRONT_STEPS.map((id, index) => {
            const state = steps?.[id] ?? "upcoming";
            const { title, action, bodyKey, content } = body(id, state);
            return (
              <StepperStep
                key={id}
                number={index + 1}
                state={state}
                isLoading={isLoading}
                title={title}
                action={action}
                isLast={index === STOREFRONT_STEPS.length - 1}
                bodyKey={bodyKey}
              >
                {content}
              </StepperStep>
            );
          })}
        </ol>

        <div className="border-t border-border pt-2.5">
          <ShareDialog trigger="link" map={map} places={places} />
        </div>
      </HeightCollapse>
    </section>
  );
}
