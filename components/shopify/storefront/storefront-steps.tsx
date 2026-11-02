"use client";

import { Button } from "@heroui/react";
import { Store } from "lucide-react";

import { pickerName } from "@/lib/shopify/storefront-maps";
import { DomainMissing } from "./domain-missing";
import { StorefrontStep } from "./storefront-step";
import type { useStorefront } from "./use-storefront";

/**
 * The way onto a Shopify store, as two numbered steps: ① put the map on the
 * list the "Pinglide map" theme block reads, ② open the theme editor with the
 * block added. docs/notes/shopify.md, "Storefront".
 *
 * At the top of the Publish sidebar's column, not in its footer: measured at
 * 390px, steps pinned in the footer took 479 of the open sheet's 482px and left
 * the design controls none. Publish stays pinned below; `primary` decides which
 * of the three is filled.
 *
 * Step 2 is never marked done: whether the block is in the theme needs
 * `read_themes`, which the app does not ask for.
 */
export function StorefrontSteps({ storefront }: { storefront: ReturnType<typeof useStorefront> }) {
  const { status, primary, onShow, onFixDomain, onRemove, isShowing, busy } = storefront;
  const current = status.data;

  return (
    <section aria-label="Shopify storefront" className="space-y-3 rounded-xl border border-border p-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Store aria-hidden="true" className="size-4" />
        Your Shopify storefront
      </h3>

      {current === undefined ? (
        status.isError ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            Couldn&rsquo;t check your storefront.
            <Button size="sm" variant="tertiary" onPress={() => void status.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted">Checking your storefront…</p>
        )
      ) : (
        <ol className="space-y-3">
          {current.onStorefront ? (
            <StorefrontStep
              number={1}
              title="On your storefront"
              state="done"
              action={
                <Button size="sm" variant="ghost" isDisabled={busy} onPress={onRemove}>
                  Remove
                </Button>
              }
            >
              {current.isDefault ? (
                <p className="text-xs text-muted">Shown by default in every Pinglide block.</p>
              ) : (
                <NotDefault isDisabled={busy} onMakeDefault={() => onShow(true)} />
              )}
              {current.domainMissing ? (
                <DomainMissing
                  storeHost={current.storeHost}
                  isDisabled={busy}
                  isPending={isShowing}
                  onFix={onFixDomain}
                />
              ) : null}
            </StorefrontStep>
          ) : (
            <StorefrontStep number={1} title="Show this map on your storefront" state="current">
              <p className="text-xs text-muted">
                Makes it available to the Pinglide map block in your theme, and
                publishes it first if it has never been published.
              </p>
              <Button
                size="sm"
                variant={primary === "show" ? "primary" : "secondary"}
                className="w-full"
                isPending={isShowing}
                onPress={() => onShow(false)}
              >
                Show on storefront
              </Button>
            </StorefrontStep>
          )}

          {current.onStorefront ? (
            <StorefrontStep number={2} title="Add the block to your theme" state="current">
              <p className="text-xs text-muted">
                {current.isDefault
                  ? "Opens your theme editor with the block added. Press Save there — once per theme. After that, Publish updates your store."
                  : `Opens your theme editor with a block added. Choose “${pickerName(current.name)}” under Map and press Save.`}
              </p>
              <Button
                size="sm"
                variant={primary === "theme" ? "primary" : "secondary"}
                className="w-full"
                onPress={() => window.open(current.addBlockUrl, "_top")}
              >
                Add to theme
              </Button>
            </StorefrontStep>
          ) : (
            <StorefrontStep number={2} title="Add the block to your theme" state="inactive" />
          )}
        </ol>
      )}
    </section>
  );
}

/**
 * A map that is not the default is chosen by name in the block's "Map" picker,
 * so there is nothing to copy — only the offer to make it the default instead.
 */
function NotDefault({ isDisabled, onMakeDefault }: { isDisabled: boolean; onMakeDefault: () => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted">
        Blocks show your default map unless you choose this one under Map.
      </p>
      <Button size="sm" variant="tertiary" isDisabled={isDisabled} onPress={onMakeDefault}>
        Show by default
      </Button>
    </div>
  );
}
