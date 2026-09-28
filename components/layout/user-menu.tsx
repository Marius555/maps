"use client";

import {
  Avatar,
  Button,
  Description,
  Dropdown,
  Header,
  Label,
  Separator,
} from "@heroui/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SupportRequestDialog } from "@/components/support/support-request-dialog";

import type { AuthUser } from "@/lib/auth/types";
import { BRAND } from "@/lib/brand";
import { initialsOf } from "@/lib/format/initials";
import { useLogout } from "@/lib/query/auth";
import type { SupportKind } from "@/lib/validation/support.schema";
import type { PlanId } from "@/lib/repositories/plan-limits";
import { UserMenuTheme } from "./user-menu-theme";

/**
 * The account menu: identity, theme, settings, the way up a plan, support, log out.
 *
 * Sits in the sidebar footer, which is where a persistent shell puts it — the
 * avatar is then in the same place on every page.
 *
 * **Text rows, and one icon.** Only Log out carries one, below a separator of
 * its own: it is the row that ends the session, and the icon plus the rule above
 * it make it the one a hand finds without reading. Every other row used to carry
 * an icon too, which gave them all the same weight and made none of them easier
 * to find.
 *
 * **The theme sits under the email**, as one row of Light / System / Dark —
 * `UserMenuTheme`. It is here as well as in Settings → General because it is
 * the one setting people reach for mid-task; both read `lib/theme/theme-choice.ts`,
 * so they cannot disagree. `ThemeSync`, not this menu, follows the OS while the
 * choice is "System".
 *
 * **Contact support and Report a bug open one form in two kinds**, mailed to the
 * support address with a subject that says which kind, which plan and which
 * topic (`lib/support/support-request.ts`), so the inbox can be triaged by
 * subject alone. Contact support is a paid-plan row: on Free it stays visible
 * but disabled, with the reason under it, and the route refuses it too. Report a
 * bug is on every plan. The dialog is rendered beside the menu, not in it,
 * since the menu closes as soon as a row is chosen.
 *
 * **Upgrade plan only when there is one.** In accent, because on Free or Starter
 * it is the honest invitation, and it opens Settings → Billing where a plan is
 * changed. On Pro there is nothing above to sell, and an accented invitation to
 * buy what you have already bought is worse than no row at all — billing is one
 * click further, inside Settings.
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
  isCollapsed = false,
  onNavigate,
}: {
  user: AuthUser;
  plan: PlanId;
  isCollapsed?: boolean;
  onNavigate?: () => void;
}) {
  const logout = useLogout();
  const router = useRouter();

  const initials = initialsOf(user.name, user.email);
  const isTopPlan = plan === "pro";
  const isFree = plan === "free";
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
              const route = ROUTES[String(key)];

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

            <UserMenuTheme />

            <Separator />

            {/* The only way into Settings. It is not a sidebar item: the sidebar
                is about the map you are working on, and this is about the person,
                which is what this menu is already for. */}
            <Dropdown.Item id="settings" textValue="Settings">
              <Label>Settings</Label>
            </Dropdown.Item>

            {isTopPlan ? null : (
              <Dropdown.Item id="upgrade" textValue="Upgrade plan">
                {/* Tinted rather than given a variant: `menuItemVariants` offers
                    `default` and `danger` only, and danger is the wrong word for
                    this entirely. */}
                <Label className="text-accent">Upgrade plan</Label>
              </Dropdown.Item>
            )}

            {/* Only once brand.json has an address: an item that opens an empty
                email to nobody is a control that does nothing. */}
            {BRAND.contact.supportEmail ? (
              <Dropdown.Item
                id="support"
                textValue="Contact support"
                isDisabled={isFree}
              >
                <div className="flex flex-col">
                  <Label>Contact support</Label>
                  {isFree ? <Description>On paid plans</Description> : null}
                </div>
              </Dropdown.Item>
            ) : null}

            <Dropdown.Item id="report-bug" textValue="Report a bug">
              <Label>Report a bug</Label>
            </Dropdown.Item>

            {/* Directly above Log out, so the one row that ends the session is
                set apart from everything that does not. */}
            <Separator />

            <Dropdown.Item id="logout" textValue="Log out" variant="danger">
              <LogOut aria-hidden="true" className="size-4" />
              <Label>Log out</Label>
            </Dropdown.Item>
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
