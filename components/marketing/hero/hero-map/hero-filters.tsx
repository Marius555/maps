"use client";

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

import {
  HERO_KIND_ORDER,
  HERO_KINDS,
  HERO_PIN_COLORS,
  type HeroFilter,
} from "@/lib/marketing/hero-map";

const OPTIONS: { id: HeroFilter; label: string; color?: string }[] = [
  { id: "all", label: "All" },
  ...HERO_KIND_ORDER.map((kind) => ({
    id: kind,
    label: HERO_KINDS[kind].many,
    color: HERO_PIN_COLORS[kind],
  })),
];

/**
 * The tag chips on the hero map: the embed's category filter, reduced to one
 * row of three kinds.
 *
 * The chosen chip's ground is one element that slides between chips
 * (`layoutId`), so a choice reads as the same highlight moving rather than one
 * going out and another coming on. Neutral rather than accent: the accent is
 * the roastery pin's orange, and a roastery dot on an orange chip disappears.
 */
export function HeroFilters({
  value,
  count,
  onChange,
}: {
  value: HeroFilter;
  count: number;
  onChange: (value: HeroFilter) => void;
}) {
  return (
    <div className="map-chrome-panel mk-hero-filters flex max-w-full min-w-0 items-center overflow-x-auto rounded-full p-1 shadow-sm">
      <ToggleButtonGroup
        size="sm"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value]}
        aria-label="Show locations"
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (next !== undefined) onChange(String(next) as HeroFilter);
        }}
      >
        {OPTIONS.map((option) => (
          <ToggleButton key={option.id} id={option.id}>
            {value === option.id ? (
              <motion.span
                layoutId="mk-hero-filter"
                className="mk-hero-filters__indicator"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            ) : null}
            {option.color ? (
              <span
                aria-hidden="true"
                className="mk-hero-filters__dot"
                style={{ background: option.color }}
              />
            ) : null}
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <LocationCount count={count} />
    </div>
  );
}

/**
 * "38 locations", counting to its new value rather than jumping. The moving
 * number is hidden from screen readers — it passes through every value on the
 * way — and a quiet live region says the settled one instead.
 */
function LocationCount({ count }: { count: number }) {
  const spring = useSpring(count, { stiffness: 180, damping: 28 });
  const text = useTransform(spring, (value) => `${Math.round(value)} locations`);

  useEffect(() => {
    spring.set(count);
  }, [spring, count]);

  return (
    <>
      <motion.span
        aria-hidden="true"
        className="hidden shrink-0 ps-2 pe-3 text-xs whitespace-nowrap text-muted tabular-nums sm:inline"
      >
        {text}
      </motion.span>
      <span aria-live="polite" className="sr-only">
        {count} locations shown
      </span>
    </>
  );
}
