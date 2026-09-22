"use client";

import {
  Avatar,
  Button,
  Dropdown,
  Header,
  Label,
  Separator,
  useTheme,
} from "@heroui/react";
import { LogOut } from "lucide-react";

import type { AuthUser } from "@/lib/auth/types";
import { BRAND } from "@/lib/brand";
import { useLogout } from "@/lib/query/auth";
import type { PlanId } from "@/lib/repositories/plan-limits";

const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
] as const;

/**
 * The account menu: identity, the way up a plan, appearance, log out.
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
 * Appearance is a submenu. The three theme choices used to sit in a labelled
 * section on this menu, which was four of its six lines spent on a setting almost
 * nobody changes twice. The chosen one is marked by `Dropdown.ItemIndicator`
 * alone now that the trigger row no longer wears the theme's icon.
 *
 * Selection moves with them. It belongs to the submenu's own `Dropdown.Menu`
 * rather than to a section of the outer one; the outer `onAction` never handled a
 * theme key and still does not.
 *
 * **The account row changes its name with the plan.** "Upgrade your account" in
 * accent is the honest label for somebody on Free or Starter, and the page it
 * opens is where a plan is changed. On Pro there is nothing above to sell, so it reads
 * "Account and billing" in the ordinary colour — an accented invitation to buy
 * what you have already bought is worse than no accent at all.
 *
 * `useTheme` is HeroUI's own hook. It persists to localStorage and sets both the
 * `.dark` class and `data-theme`, which is exactly what globals.css keys off, so
 * no theme provider or extra dependency is needed. The pre-paint script in
 * components/providers/theme-script.tsx handles the first render.
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
  // The cross-fade needs no coordination here: globals.css transitions the
  // registered colour tokens on :root, so changing the theme is enough.
  const { theme, setTheme } = useTheme();

  const initials = getInitials(user.name, user.email);
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

          {/* The only way into the account page. It is not a sidebar item: the
              sidebar is about the map you are working on, and this is about the
              person, which is what this menu is already for. */}
          <Dropdown.Item
            id="account"
            textValue={isTopPlan ? "Account and billing" : "Upgrade your account"}
            href="/account"
          >
            {/* Tinted rather than given a variant: `menuItemVariants` offers
                `default` and `danger` only, and danger is the wrong word for
                this entirely. */}
            <Label className={isTopPlan ? undefined : "text-accent"}>
              {isTopPlan ? "Account and billing" : "Upgrade your account"}
            </Label>
          </Dropdown.Item>

          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="appearance" textValue="Appearance">
              <Label>Appearance</Label>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>

            <Dropdown.Popover className="min-w-40">
              <Dropdown.Menu
                selectionMode="single"
                selectedKeys={new Set([theme])}
                onSelectionChange={(keys) => {
                  const next = [...keys][0];
                  if (typeof next === "string") setTheme(next);
                }}
              >
                {THEMES.map(({ id, label }) => (
                  <Dropdown.Item key={id} id={id} textValue={label}>
                    <Label>{label}</Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>

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

/** Initials from the name, falling back to the email's first letter. */
function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return email.slice(0, 1).toUpperCase() || "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
