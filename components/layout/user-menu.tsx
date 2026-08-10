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
import { Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";

import type { AuthUser } from "@/lib/auth/types";
import { useLogout } from "@/lib/query/auth";

const THEMES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const;

/**
 * The account menu: identity, appearance, log out.
 *
 * Sits in the sidebar footer, which is where a persistent shell puts it — the
 * avatar is then in the same place on every page.
 *
 * `useTheme` is HeroUI's own hook. It persists to localStorage and sets both the
 * `.dark` class and `data-theme`, which is exactly what globals.css keys off, so
 * no theme provider or extra dependency is needed. The pre-paint script in
 * app/layout.tsx handles the first render.
 */
export function UserMenu({
  user,
  isCollapsed = false,
}: {
  user: AuthUser;
  isCollapsed?: boolean;
}) {
  const router = useRouter();
  const logout = useLogout();
  // The cross-fade needs no coordination here: globals.css transitions the
  // registered colour tokens on :root, so changing the theme is enough.
  const { theme, setTheme } = useTheme();

  const initials = getInitials(user.name, user.email);

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
            if (key !== "logout") return;

            await logout.mutateAsync();
            router.replace("/login");
            // The dashboard is server-rendered, so the cleared session has to
            // reach the server before the redirect paints.
            router.refresh();
          }}
        >
          <Dropdown.Section>
            <Header>{user.email}</Header>
          </Dropdown.Section>

          <Separator />

          <Dropdown.Section
            selectionMode="single"
            selectedKeys={new Set([theme])}
            onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (typeof next === "string") setTheme(next);
            }}
          >
            <Header>Appearance</Header>
            {THEMES.map(({ id, label, icon: Icon }) => (
              <Dropdown.Item key={id} id={id} textValue={label}>
                <Icon aria-hidden="true" className="size-4" />
                <Label>{label}</Label>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            ))}
          </Dropdown.Section>

          <Separator />

          <Dropdown.Item id="logout" textValue="Log out" variant="danger">
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
