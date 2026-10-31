"use client";

import { Dropdown, Label } from "@heroui/react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import {
  setThemeChoice,
  THEME_CHOICES,
  useThemeChoice,
  type ThemeChoice,
} from "@/lib/theme/theme-choice";
import { MD_DOWN, useMediaQuery } from "@/lib/ui/use-media-query";

const OPTIONS: Record<ThemeChoice, { label: string; Icon: LucideIcon }> = {
  light: { label: "Light", Icon: Sun },
  system: { label: "System", Icon: Monitor },
  dark: { label: "Dark", Icon: Moon },
};

/**
 * One **Theme** row under the account's email, opening Light / System / Dark.
 *
 * **A submenu, `Dropdown.SubmenuTrigger`** — React Aria's own, so it opens on
 * hover, on a press and on ArrowRight, and the three choices are real menu items
 * a keyboard walks like the rest of the menu. It replaced a row of three tiles
 * that took a whole band of the menu for a setting changed once.
 *
 * **The same store as Settings → General** (`lib/theme/theme-choice.ts`), never
 * HeroUI's `useTheme` — see that file for why a second copy of the choice was a
 * bug. Nothing is selected, and the row names no current choice, until
 * hydration, for the reason `AppearancePicker` gives.
 */
export function UserMenuTheme() {
  const choice = useThemeChoice();
  /*
   * Below `md` the menu sits in the nav drawer, nearly as wide as the phone,
   * and a submenu beside it ran ~20px off the screen's right edge (measured at
   * 390px). There it drops below the Theme row instead, covering the rows
   * beneath it while it is open.
   */
  const isNarrow = useMediaQuery(MD_DOWN);

  return (
    <Dropdown.SubmenuTrigger>
      <Dropdown.Item id="theme" textValue="Theme">
        <Label>Theme</Label>
        <span className="ms-auto text-xs text-muted">
          {choice ? OPTIONS[choice].label : null}
        </span>
        <Dropdown.SubmenuIndicator />
      </Dropdown.Item>

      <Dropdown.Popover
        className="min-w-40"
        placement={isNarrow ? "bottom end" : undefined}
      >
        <Dropdown.Menu
          aria-label="Theme"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={choice ? [choice] : []}
          onSelectionChange={(keys) => {
            const next = keys === "all" ? undefined : [...keys][0];
            if (next === "light" || next === "dark" || next === "system") {
              setThemeChoice(next);
            }
          }}
        >
          {THEME_CHOICES.map((id) => {
            const { label, Icon } = OPTIONS[id];

            return (
              <Dropdown.Item key={id} id={id} textValue={label}>
                <Icon aria-hidden="true" className="size-4 text-muted" />
                <Label>{label}</Label>
                <Dropdown.ItemIndicator className="ms-auto" />
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.SubmenuTrigger>
  );
}
