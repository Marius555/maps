"use client";

import { Radio, RadioGroup } from "@heroui/react";

import {
  setThemeChoice,
  THEME_CHOICES,
  useThemeChoice,
  type ThemeChoice,
} from "@/lib/theme/theme-choice";
import { ThemePreview } from "./theme-preview";

const LABELS: Record<ThemeChoice, string> = {
  light: "Light",
  system: "Match system",
  dark: "Dark",
};

/**
 * Light, dark, or whatever the device is set to, shown rather than named.
 *
 * It was three words in a submenu of the account menu. Here each one is a
 * picture of the dashboard in that mode, the way claude.ai draws its own, so the
 * choice is made by recognition.
 *
 * **A HeroUI `RadioGroup`**, so arrow keys move between the three and a screen
 * reader hears one question with three answers. It saves on selection, with no
 * Save button, because you try a theme by looking at it.
 *
 * **Nothing is selected until the page has hydrated.** The choice lives in this
 * browser's storage, which the server cannot read, so `useThemeChoice` answers
 * null there. The alternative was to render a guess and correct it, which is a
 * wrong answer shown briefly and a hydration mismatch. On a client-side visit
 * the value is already known and the right tile is marked on the first frame.
 * The selection is drawn as a border colour on a border that is always there, so
 * it arriving moves nothing.
 */
export function AppearancePicker() {
  const choice = useThemeChoice();

  return (
    <RadioGroup
      aria-label="Colour mode"
      orientation="horizontal"
      value={choice}
      onChange={(value) => setThemeChoice(value as ThemeChoice)}
      className="grid grid-cols-3 gap-3 sm:max-w-lg sm:gap-4"
    >
      {THEME_CHOICES.map((option) => (
        <Radio key={option} value={option} className="min-w-0 w-full">
          <Radio.Content className="group flex w-full min-w-0 flex-col items-stretch gap-2.5">
            <span className="block rounded-xl border-2 border-border p-0.5 transition-colors duration-[var(--duration-fast)] group-data-[hovered=true]:border-muted/50 group-data-[selected=true]:border-accent group-data-[focus-visible=true]:outline-2 group-data-[focus-visible=true]:outline-offset-2 group-data-[focus-visible=true]:outline-focus">
              <span className="block overflow-hidden rounded-[0.55rem]">
                <ThemePreview choice={option} />
              </span>
            </span>

            <span className="flex min-w-0 items-center gap-2">
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <span className="truncate text-sm font-normal">{LABELS[option]}</span>
            </span>
          </Radio.Content>
        </Radio>
      ))}
    </RadioGroup>
  );
}
