"use client";

import { Avatar, Button, Dropdown, Header, Label, Separator } from "@heroui/react";
import { LogOut } from "lucide-react";

import type { AuthUser } from "@/lib/auth/types";
import { BRAND } from "@/lib/brand";
import { initialsOf } from "@/lib/format/initials";
import { useLogout } from "@/lib/query/auth";
import type { PlanId } from "@/lib/repositories/plan-limits";

/**
 * The account menu: identity, settings, the way up a plan, log out.
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
 * **No appearance here any more.** The theme was a submenu on this menu, and it
 * moved to Settings → General, where it sits beside everything else about the
 * person and can show what each choice looks like. This menu is for going
 * somewhere, not for setting things. Moving it had one consequence worth knowing:
 * this component's `useTheme` was, invisibly, what followed the OS while the
 * choice was "System" — `ThemeSync` does that now (see its docblock).
 *
 * **Upgrade plan only when there is one.** In accent, because on Free or Starter
 * it is the honest invitation, and it opens Settings → Billing where a plan is
 * changed. On Pro there is nothing above to sell, and an accented invitation to
 * buy what you have already bought is worse than no row at all — billing is one
 * click further, inside Settings.
 */
export function UserMenu({
  user,
  plan,
  isCollapsed = false,
}: {
  user: AuthUser;
  plan: PlanId;
  isCollapsed?: boolean;
}) {
  const logout = useLogout();

  const initials = initialsOf(user.name, user.email);
  const isTopPlan = plan === "pro";

  return (
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
            if (key === "support") {
              window.location.href = `mailto:${BRAND.contact.supportEmail}`;
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

          {/* The only way into Settings. It is not a sidebar item: the sidebar
              is about the map you are working on, and this is about the person,
              which is what this menu is already for. */}
          <Dropdown.Item id="settings" textValue="Settings" href="/settings/general">
            <Label>Settings</Label>
          </Dropdown.Item>

          {isTopPlan ? null : (
            <Dropdown.Item id="upgrade" textValue="Upgrade plan" href="/settings/billing">
              {/* Tinted rather than given a variant: `menuItemVariants` offers
                  `default` and `danger` only, and danger is the wrong word for
                  this entirely. */}
              <Label className="text-accent">Upgrade plan</Label>
            </Dropdown.Item>
          )}

          {/* Only once brand.json has an address: an item that opens an empty
              email to nobody is a control that does nothing. */}
          {BRAND.contact.supportEmail ? (
            <Dropdown.Item id="support" textValue="Contact support">
              <Label>Contact support</Label>
            </Dropdown.Item>
          ) : null}

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
  );
}
