"use client";

import { Avatar, Button, Dropdown, Header, Label, Separator } from "@heroui/react";
import { LogOut } from "lucide-react";

import { UserMenuTheme } from "@/components/layout/user-menu-theme";
import { initialsOf } from "@/lib/format/initials";
import { useAdminLogout } from "@/lib/query/admin";

/**
 * The console's account menu, in the sidebar footer where the customer shell
 * keeps `UserMenu` — the same button, the same theme row, the same Log out.
 * The admin has no settings, plan or support to offer, so those rows are not
 * here.
 *
 * Log out leaves as a document navigation, like the customer logout, so Back
 * cannot restore a console page. It leaves even when the call fails — an
 * expired session answers 401, and that is signed out already.
 */
export function AdminAccountMenu({ email }: { email: string }) {
  const logout = useAdminLogout();

  return (
    <Dropdown>
      <Button
        aria-label="Account menu"
        variant="tertiary"
        isPending={logout.isPending}
        className="h-auto w-full justify-start gap-2 rounded-xl px-2 py-1.5"
      >
        <Avatar size="sm">
          <Avatar.Fallback>{initialsOf("", email)}</Avatar.Fallback>
        </Avatar>
        <span className="min-w-0 flex-1 overflow-hidden text-left">
          <span className="block truncate text-sm font-medium text-foreground">Administrator</span>
          <span className="block truncate text-xs font-normal text-muted">{email}</span>
        </span>
      </Button>

      <Dropdown.Popover placement="top start" className="min-w-56">
        <Dropdown.Menu
          onAction={(key) => {
            if (key !== "logout") return;

            logout.mutate(undefined, {
              onSettled: () => window.location.replace("/login/admin"),
            });
          }}
        >
          <Dropdown.Section>
            <Header>{email}</Header>
          </Dropdown.Section>

          <UserMenuTheme />

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
