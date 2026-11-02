"use client";

import { Button } from "@heroui/react";
import { Store } from "lucide-react";

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
 *   ① Show on your storefront   ② Add the block to your theme   ③ Publish your changes
 *
 * Only the step the merchant is on is open and has a filled button; finished
 * steps fold to a line with a check, later ones are grey. Publish is drawn in
 * step 3 in every state — filled only when it is the next thing to do — so a
 * map off the storefront, or one only embedded elsewhere, is never stuck.
 *
 * Everything that is not the next step is words, not a button: Remove, Make
 * default, Already added, Open editor, Embed on another site. It replaced one
 * dense row of four similar buttons that did not say which to press.
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
    onShow,
    onRemove,
    onFixDomain,
    onAddToTheme,
    onAlreadyAdded,
    isShowing,
    busy,
  } = storefront;
  const current = status.data;

  // The status sits beside the button rather than above it: one line fewer in
  // a pinned footer, and it reads as the button's own caption.
  const publish = (
    <PublishAction
      mapId={map.id}
      compact
      variant={primary === "publish" ? "primary" : "secondary"}
      onStorefront={current?.onStorefront === true}
      status={<PublishStatus map={map} hasPendingChanges={hasPendingChanges} storefront />}
    />
  );

  return (
    <section aria-labelledby="storefront-stepper-title" className="space-y-3">
      <h3
        id="storefront-stepper-title"
        className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase"
      >
        <Store aria-hidden="true" className="size-3.5" />
        Your store
      </h3>

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
                <Button size="sm" variant="primary" isPending={isShowing} onPress={() => onShow(false)}>
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
            action={
              steps.theme === "done" ? (
                <TextAction onPress={onAddToTheme}>Open editor</TextAction>
              ) : null
            }
          >
            {steps.theme === "current" ? (
              <>
                <p className="text-xs text-pretty text-muted">
                  {current.isDefault
                    ? "Opens your theme editor with the block added. Press Save there."
                    : `Opens your theme editor with a block added. Choose “${pickerName(current.name)}” under Map, then press Save.`}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Button size="sm" variant="primary" onPress={onAddToTheme}>
                    Add to theme
                  </Button>
                  <TextAction onPress={onAlreadyAdded}>Already added</TextAction>
                </div>
              </>
            ) : null}
          </StepperStep>

          <StepperStep number={3} state={steps.publish} title="Publish your changes" isLast>
            {publish}
          </StepperStep>
        </ol>
      )}

      <div className="border-t border-border pt-2.5">
        <ShareDialog trigger="link" map={map} places={places} isMeasuring={isMeasuring} />
      </div>
    </section>
  );
}
