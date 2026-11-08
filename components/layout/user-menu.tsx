"use client";

import {
  Avatar,
  Button,
  Dropdown,
  Header,
  Label,
  Separator,
} from "@heroui/react";
import {
  Bug,
  CircleArrowUp,
  CreditCard,
  LifeBuoy,
  LogOut,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SupportRequestDialog } from "@/components/support/support-request-dialog";
import { settingsHomeFor } from "@/components/user-settings/shell/settings-items";

import type { AuthUser } from "@/lib/auth/types";
import { BRAND } from "@/lib/brand";
import { initialsOf } from "@/lib/format/initials";
import { useLogout } from "@/lib/query/auth";
import type { SupportKind } from "@/lib/validation/support.schema";
import type { PlanId } from "@/lib/repositories/plan-limits";

/** Shared by every row's icon except Log out's, which takes the danger colour. */
const ICON = "size-4 shrink-0 text-muted";

/**
 * The account menu: identity, the way up a plan, settings, support, log out.
 *
 * Sits in the sidebar footer, which is where a persistent shell puts it — the
 * avatar is then in the same place on every page.
 *
 * **An icon on every row** (the owner's call, 2026-11-07, reversing an earlier
 * text-only menu). Each was chosen to name what the row does rather than
 * decorate it: `CircleArrowUp` for moving up a plan (`CreditCard` for Shopify's
 * Change plan, which can be a downgrade), the gear for Settings, `LifeBuoy` for
 * help from a person, `Bug` for a bug. Log out keeps its own separator and the
 * danger colour, so it is still the row a hand finds without reading.
 *
 * **No theme row.** The theme is chosen in Settings → General, one click away;
 * a second picker here was a duplicate. (The admin console's menu still has
 * `UserMenuTheme`.) `ThemeSync` follows the OS while the choice is "System".
 *
 * **Contact support and Report a bug open one form in two kinds**, mailed to the
 * support address with a subject that says which kind, which plan and which
 * topic (`lib/support/support-request.ts`), so the inbox can be triaged by
 * subject alone. Contact support is a paid-plan row and is **not drawn on
 * Free** (the route refuses it too); "Free" is the best plan the person works
 * under, so a member of a paid team still has it. Report a bug is on every
 * plan. The dialog is rendered beside the menu, not in it, since the menu
 * closes as soon as a row is chosen.
 *
 * **Upgrade plan first, and only when there is one.** In accent, because on Free or Starter
 * it is the honest invitation, and it opens Settings → Billing where a plan is
 * changed. On Pro there is nothing above to sell, and an accented invitation to
 * buy what you have already bought is worse than no row at all — billing is one
 * click further, inside Settings. **Inside Shopify the row opens Shopify's plan
 * page and stays on Pro, as Change plan**: a shop must be able to downgrade
 * without contacting us (App Store requirement 1.2.3).
 *
 * **Settings and Upgrade go through the router, not `href`.** An `href` item is
 * a React Aria link, and with no `RouterProvider` in the app React Aria follows
 * it natively — a full document load that threw away the shell, the providers
 * and the query cache on the way into Settings. A global `RouterProvider` would
 * fix that too, but it would also turn every HeroUI `href` in the app, API
 * downloads included, into a router push; this is the two items that needed it.
 * `onNavigate` is how the mobile drawer closes, which the reload used to do.
 */
const ROUTES: Record<string, string> = {
  settings: "/settings/general",
  upgrade: "/settings/billing",
};

export function UserMenu({
  user,
  plan,
  personalPlan,
  isCollapsed = false,
  onNavigate,
}: {
  user: AuthUser;
  /** The person's own plan: Upgrade is about their own account, whatever team is open. */
  plan: PlanId;
  /** The best plan they work under: a member of a paid team may email support. */
  personalPlan: PlanId;
  isCollapsed?: boolean;
  onNavigate?: () => void;
}) {
  const logout = useLogout();
  const router = useRouter();

  const initials = initialsOf(user.name, user.email);
  const isTopPlan = plan === "pro";
  const isFree = personalPlan === "free";
  // The kind outlives the open flag, so the dialog keeps its title while it closes.
  const [supportKind, setSupportKind] = useState<SupportKind>("bug");
  const [isSupportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <Dropdown>
        {/*
         * A HeroUI Button, reshaped — not a raw <button>. Dropdown wraps its
         * trigger in a React Aria PressResponder, which warns (and loses press
         * handling) unless the child is a real pressable. The recipe's fixed
         * height, pill radius and centring are overridden here.
         */}
        <Button
          aria-label="Account menu"
          variant="tertiary"
          className={`h-auto w-full rounded-xl px-2 py-1.5 ${
            isCollapsed ? "justify-center gap-0" : "justify-start gap-2"
          }`}
        >
          <Avatar size="sm">
            <Avatar.Fallback>{initials}</Avatar.Fallback>
          </Avatar>

          {/* Collapsed to zero width rather than unmounted, so it travels with the
              panel. The avatar and aria-label identify the control either way. */}
          <span
            aria-hidden={isCollapsed}
            className={`min-w-0 flex-1 overflow-hidden text-left transition-[max-width,opacity] duration-[var(--duration-panel)] ease-[var(--ease-out-fluid)] ${
              isCollapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100"
            }`}
          >
            <span className="block truncate text-sm font-medium text-foreground">
              {user.name || "Account"}
            </span>
            <span className="block truncate text-xs font-normal text-muted">
              {user.email}
            </span>
          </span>
        </Button>

        <Dropdown.Popover placement="top start" className="min-w-56">
          <Dropdown.Menu
            onAction={async (key) => {
              // Inside Shopify a plan is bought on Shopify's own page, in the
              // admin's top window (docs/notes/shopify.md, "Billing").
              if (key === "upgrade" && user.shopify) {
                window.open(user.shopify.pricingUrl, "_top");
                return;
              }

              // A shop's Settings start at Billing: it has no General.
              const route =
                key === "settings" ? settingsHomeFor(Boolean(user.shopify)) : ROUTES[String(key)];

              if (route) {
                onNavigate?.();
                router.push(route);
                return;
              }

              if (key === "support" || key === "report-bug") {
                setSupportKind(key === "support" ? "support" : "bug");
                setSupportOpen(true);
                return;
              }

              if (key !== "logout") return;

              await logout.mutateAsync();

              // A document navigation, not `router.replace`. A soft replace
              // consumes the one page you are on and leaves every dashboard page
              // behind it in the history stack, reachable through the client
              // router cache — where no guard runs, because a history restore
              // makes no request. Tearing the document down is what makes Back a
              // real request that `proxy.ts` can answer.
              window.location.replace("/login");
            }}
          >
            <Dropdown.Section>
              <Header>{user.email}</Header>
            </Dropdown.Section>

            <Separator />

            {isTopPlan && !user.shopify ? null : (
              <Dropdown.Item id="upgrade" textValue={isTopPlan ? "Change plan" : "Upgrade plan"}>
                {/* Tinted rather than given a variant: `menuItemVariants` offers
                    `default` and `danger` only, and danger is the wrong word for
                    this entirely. Inside Shopify it stays on Pro as Change plan:
                    a shop must be able to downgrade without asking us (App
                    Store requirement 1.2.3), and Shopify's page is where. */}
                {isTopPlan ? (
                  <CreditCard aria-hidden="true" className="size-4 shrink-0 text-accent" />
                ) : (
                  <CircleArrowUp aria-hidden="true" className="size-4 shrink-0 text-accent" />
                )}
                <Label className="text-accent">{isTopPlan ? "Change plan" : "Upgrade plan"}</Label>
              </Dropdown.Item>
            )}

            {/* The only way into Settings. It is not a sidebar item: the sidebar
                is about the map you are working on, and this is about the person,
                which is what this menu is already for. */}
            <Dropdown.Item id="settings" textValue="Settings">
              <Settings aria-hidden="true" className={ICON} />
              <Label>Settings</Label>
            </Dropdown.Item>

            {/* Only once brand.json has an address: an item that opens an empty
                email to nobody is a control that does nothing. */}
            {BRAND.contact.supportEmail && !isFree ? (
              <Dropdown.Item id="support" textValue="Contact support">
                <LifeBuoy aria-hidden="true" className={ICON} />
                <Label>Contact support</Label>
              </Dropdown.Item>
            ) : null}

            <Dropdown.Item id="report-bug" textValue="Report a bug">
              <Bug aria-hidden="true" className={ICON} />
              <Label>Report a bug</Label>
            </Dropdown.Item>

            {/* Directly above Log out, so the one row that ends the session is
                set apart from everything that does not. Not inside Shopify:
                there is no session of ours to end — Shopify signs the merchant
                in, and out. */}
            {user.shopify ? null : (
              <>
                <Separator />

                <Dropdown.Item id="logout" textValue="Log out" variant="default">
                  <LogOut aria-hidden="true" className="size-4 shrink-0" />
                  <Label>Log out</Label>
                </Dropdown.Item>
              </>
            )}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <SupportRequestDialog
        kind={supportKind}
        isOpen={isSupportOpen}
        accountEmail={user.email}
        onOpenChange={setSupportOpen}
      />
    </>
  );
}
