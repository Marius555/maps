"use client";

import { Dropdown, Label } from "@heroui/react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import {
  setThemeChoice,
  THEME_CHOICES,
  useThemeChoice,
  type ThemeChoice,
} from "@/lib/theme/theme-choice";

const OPTIONS: Record<ThemeChoice, { label: string; Icon: LucideIcon }> = {
  light: { label: "Light", Icon: Sun },
  system: { label: "System", Icon: Monitor },
  dark: { label: "Dark", Icon: Moon },
};

/**
 * Light, System, Dark as one row under the account's email.
 *
 * **A selectable section of the menu itself**, not buttons laid inside it: React
 * Aria's menu owns focus, so anything that is not an item is unreachable by
 * keyboard. As a single-selection section the three are announced as a choice
 * and arrow keys walk them like the rest of the menu.
 *
 * **The same store as Settings → General** (`lib/theme/theme-choice.ts`), never
 * HeroUI's `useTheme` — see that file for why a second copy of the choice was a
 * bug. Nothing is selected until hydration, for the reason `AppearancePicker`
 * gives.
 *
 * It does not close the menu, so a theme can be tried and another picked.
 */
export function UserMenuTheme() {
  const choice = useThemeChoice();

  return (
    <Dropdown.Section
      aria-label="Colour mode"
      selectionMode="single"
      disallowEmptySelection
      shouldCloseOnSelect={false}
      selectedKeys={choice ? [choice] : []}
      onSelectionChange={(keys) => {
        const next = keys === "all" ? undefined : [...keys][0];
        if (next === "light" || next === "dark" || next === "system") {
          setThemeChoice(next);
        }
      }}
      className="grid grid-cols-3 gap-1 px-1 pb-1"
    >
      {THEME_CHOICES.map((id) => {
        const { label, Icon } = OPTIONS[id];

        return (
          <Dropdown.Item
            key={id}
            id={id}
            textValue={label}
            className="h-auto flex-col justify-center gap-1 rounded-lg px-1 py-2 text-muted data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
          >
            <Icon aria-hidden="true" className="size-4" />
            <Label className="text-xs text-inherit">{label}</Label>
          </Dropdown.Item>
        );
      })}
    </Dropdown.Section>
  );
}
