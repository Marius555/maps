"use client";

import { Button } from "@heroui/react";
import { Store } from "lucide-react";
import { useId } from "react";

import { PublishAction } from "@/components/publish/publish-action";
import { PublishStatus } from "@/components/publish/publish-status";
import { ShareDialog } from "@/components/publish/share-dialog/share-dialog";
import type { AppMap, Place } from "@/lib/repositories/types";
import { pickerName } from "@/lib/shopify/storefront-maps";
import { DomainMissing } from "./domain-missing";
import { StepperStep } from "./stepper-step";
import { TextAction } from "./text-action";
import type { useStorefront } from "./use-storefront";

/**
 * The Publish footer inside the Shopify admin: the whole path onto the store
 * as three numbered steps, read top to bottom (docs/notes/shopify.md, "The
 * Publish footer inside Shopify").
 *
 *   YOUR STORE                                  ● Live · 1 h ago
 *   ① Show on your storefront   ② Add the block to your theme   ③ Redeploy / up to date
 *
 * Only the step the merchant is on is open and has a filled button; finished
 * steps fold to a line with a check, later ones are grey. Whether the map is
 * live, and since when, is on the heading row, in every state. Every button is
 * full width.
 *
 * **Step 3 exists only when there is something to send** (`needsPublish`:
 * edits since the last publish, or never published). Then it holds Redeploy —
 * filled only when it is next, so a map off the storefront, or one only
 * embedded elsewhere, is never stuck with edits it cannot push — and Go to
 * theme hides. Without, there are two steps and Go to theme, in step 2, ends
 * the list. One button at a time; the theme button is step 2's alone, and
 * there is no "up to date" step (2026-11-03).
 *
 * Everything that is not the next step is words, not a button: Remove, Make
 * default, Already added, Embed on another site. It replaced one dense row of
 * four similar buttons that did not say which to press.
 */
export function StorefrontStepper({
  map,
  places,
  isMeasuring,
  hasPendingChanges,
  storefront,
}: {
  map: AppMap;
  places: Place[];
  isMeasuring: boolean;
  hasPendingChanges: boolean;
  storefront: ReturnType<typeof useStorefront>;
}) {
  const {
    status,
    steps,
    primary,
    needsPublish,
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
  // `useId`, not a fixed id: the sidebar draws this twice — in the footer at
  // `lg`, at the top of the scroller below it — with CSS hiding one.
  const titleId = useId();

  // Redeploy rather than Publish once anything is live: it re-sends a map the
  // store already shows. The one map never published says Publish.
  const publish = needsPublish ? (
    <PublishAction
      mapId={map.id}
      compact
      redeploy={published}
      variant={primary === "publish" ? "primary" : "secondary"}
      onStorefront={current?.onStorefront === true}
    />
  ) : null;

  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h3
          id={titleId}
          className="flex shrink-0 items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase"
        >
          <Store aria-hidden="true" className="size-3.5" />
          Your store
        </h3>
        <PublishStatus map={map} hasPendingChanges={hasPendingChanges} storefront />
      </div>

      {steps === null || current === undefined ? (
        <div className="space-y-3">
          {status.isError ? (
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
              Couldn&rsquo;t check your storefront.
              <TextAction onPress={() => void status.refetch()}>Try again</TextAction>
            </p>
          ) : (
            <p className="text-xs text-muted">Checking your storefront…</p>
          )}
          {publish}
        </div>
      ) : (
        <ol>
          <StepperStep
            number={1}
            state={steps.show}
            title="Show on your storefront"
            action={
              steps.show === "done" ? (
                <TextAction tone="danger" isDisabled={busy} onPress={onRemove}>
                  Remove
                </TextAction>
              ) : null
            }
          >
            {steps.show === "current" ? (
              <>
                <p className="text-xs text-pretty text-muted">
                  Makes this map available to the Pinglide block in your theme.
                </p>
                <Button
                  className="w-full"
                  size="sm"
                  variant="primary"
                  isPending={isShowing}
                  onPress={() => onShow(false)}
                >
                  Show on storefront
                </Button>
              </>
            ) : null}

            {steps.show === "done" && !current.isDefault ? (
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                Not your default map.
                <TextAction isDisabled={busy} onPress={() => onShow(true)}>
                  Make default
                </TextAction>
              </p>
            ) : null}

            {steps.show === "done" && current.domainMissing ? (
              <DomainMissing
                storeHost={current.storeHost}
                isDisabled={busy}
                isPending={isShowing}
                onFix={onFixDomain}
              />
            ) : null}
          </StepperStep>

          <StepperStep
            number={2}
            state={steps.theme}
            title="Add the block to your theme"
            isLast={!needsPublish}
          >
            {steps.theme === "current" ? (
              <>
                <p className="text-xs text-pretty text-muted">
                  {current.isDefault
                    ? "Opens your theme editor with the block added. Press Save there."
                    : `Opens your theme editor with a block added. Choose “${pickerName(current.name)}” under Map, then press Save.`}
                </p>
                <div className="space-y-1.5">
                  <Button className="w-full" size="sm" variant="primary" onPress={onAddToTheme}>
                    Add to theme
                  </Button>
                  <TextAction onPress={onAlreadyAdded}>Already added</TextAction>
                </div>
              </>
            ) : null}

            {/* Set up and nothing to send: the theme, as it is, last in the
                list. With edits it gives way to Redeploy below — one button at
                a time. */}
            {steps.theme === "done" && !needsPublish ? (
              <Button className="w-full" size="sm" variant="secondary" onPress={onGoToTheme}>
                Go to theme
              </Button>
            ) : null}
          </StepperStep>

          {/* Only when there is something to send — never as a finished
              "up to date" step (the owner's call, 2026-11-03). */}
          {needsPublish ? (
            <StepperStep
              number={3}
              state={steps.publish}
              title={published ? "Redeploy your changes" : "Publish your map"}
              isLast
            >
              {publish}
            </StepperStep>
          ) : null}
        </ol>
      )}

      <div className="border-t border-border pt-2.5">
        <ShareDialog trigger="link" map={map} places={places} isMeasuring={isMeasuring} />
      </div>
    </section>
  );
}
