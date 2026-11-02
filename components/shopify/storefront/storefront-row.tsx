"use client";

import { Button, Tooltip } from "@heroui/react";
import { EyeOff, Star, Store } from "lucide-react";

import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import { pickerName } from "@/lib/shopify/storefront-maps";
import { DomainMissing } from "./domain-missing";
import type { useStorefront } from "./use-storefront";

/**
 * Where this map stands on the shop's storefront, and the one thing to press
 * next — a single row in the Publish footer, beside Publish
 * (docs/notes/shopify.md, "The Publish footer inside Shopify").
 *
 * It replaced two numbered steps at the top of the design column. Pinned or
 * scrolled, those took a quarter of the column's height to say what this says
 * in one line, and every line they took was one the design folds lost. So:
 *
 * - **Not on the storefront** — the whole row is the Show on storefront button.
 *   The label already says the map isn't there.
 * - **On it** — the state, Add to theme, and a menu holding the two rarer moves
 *   (Show by default, Remove). Add to theme is never marked done: telling needs
 *   `read_themes`, which the app does not ask for.
 * - **Not the default** — one line saying which entry to pick in the block,
 *   because without it the block shows the default map and nothing says why.
 *
 * Which of Show, Add to theme and Publish is filled is `storefrontPrimary`'s
 * answer, shared with the Publish button through `useStorefront`.
 */
export function StorefrontRow({ storefront }: { storefront: ReturnType<typeof useStorefront> }) {
  const { status, primary, onShow, onFixDomain, onRemove, isShowing, busy } = storefront;
  const current = status.data;

  if (current === undefined) {
    return (
      <div className="flex min-h-8 items-center gap-2 text-xs text-muted">
        <Store aria-hidden="true" className="size-4 shrink-0" />
        {status.isError ? (
          <>
            <span className="min-w-0 flex-1">Couldn&rsquo;t check your storefront.</span>
            <Button size="sm" variant="tertiary" onPress={() => void status.refetch()}>
              Try again
            </Button>
          </>
        ) : (
          <span>Checking your storefront…</span>
        )}
      </div>
    );
  }

  if (!current.onStorefront) {
    return (
      <Button
        size="sm"
        className="w-full"
        variant={primary === "show" ? "primary" : "secondary"}
        isPending={isShowing}
        isDisabled={busy && !isShowing}
        onPress={() => onShow(false)}
      >
        <Store aria-hidden="true" className="size-4" />
        Show on storefront
      </Button>
    );
  }

  const menu: RowMenuItem[] = [
    ...(current.isDefault
      ? []
      : [{ id: "default", label: "Show by default", icon: Star, onAction: () => onShow(true) }]),
    { id: "remove", label: "Remove from storefront", icon: EyeOff, isDanger: true, onAction: onRemove },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {/* The icon in the success colour is the "done" mark. A separate check
            beside the words cost the 14px that made them truncate in the
            20rem column. */}
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-foreground">
          <Store aria-hidden="true" className="size-4 shrink-0 text-success" />
          <span className="truncate">On your storefront</span>
        </p>

        <Tooltip delay={0}>
          <Button
            size="sm"
            className="shrink-0"
            variant={primary === "theme" ? "primary" : "secondary"}
            onPress={() => window.open(current.addBlockUrl, "_top")}
          >
            Add to theme
          </Button>
          {/* `break-normal`: HeroUI's tooltip is `break-all`, which split a
              sentence mid-word ("blo ck") — right for an id, wrong for prose. */}
          <Tooltip.Content placement="top" className="max-w-56 break-normal text-pretty">
            Opens your theme editor with the block added. Press Save there, once per theme.
          </Tooltip.Content>
        </Tooltip>

        <RowMenu label="More storefront actions" items={menu} isDisabled={busy} />
      </div>

      {current.isDefault ? null : (
        <p className="pl-5.5 text-xs text-pretty text-muted">
          In the block, choose &ldquo;{pickerName(current.name)}&rdquo; under Map.
        </p>
      )}

      {current.domainMissing ? (
        <DomainMissing
          storeHost={current.storeHost}
          isDisabled={busy}
          isPending={isShowing}
          onFix={onFixDomain}
        />
      ) : null}
    </div>
  );
}
