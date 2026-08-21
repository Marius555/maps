"use client";

import { Header, ListBox, Select } from "@heroui/react";
import type { ReactNode } from "react";

import type { SelectOption } from "./select-control";

/**
 * A select that looks like the thing it is setting, not like a form field.
 *
 * `SelectControl` is the right control inside a form: it always renders a
 * visible `<Label>` above a full-height trigger, which is what a stack of fields
 * wants. It is the wrong control inside a table header, where the label *is* the
 * value and the whole cell is about 40px tall. Rather than growing that
 * component a `hideLabel` and a `size` and a trigger override — three props that
 * exist to switch it into being a different component — this is that different
 * component, sharing its option type.
 *
 * **The accessible name is the caller's job.** With no `<Label>`, React Aria has
 * nothing to build the trigger's name from, and passing only `aria-label` would
 * announce "Column" with no hint of what it currently holds. So `label` is the
 * whole sentence — "Column 'addr1', currently Street address" — which is more
 * useful than the default would have been anyway, because it names the column
 * as well as the value.
 *
 * **Options may be grouped.** A run of options sharing a `section` is drawn
 * under that heading. It exists because the menu this control opens can be
 * fourteen rows that all look alike, and a heading is what turns "here is every
 * field" into "here are the ones that fit, and here is everything else".
 */
export function InlineSelect({
  label,
  options,
  value,
  className = "",
  children,
  onChange,
}: {
  /** The trigger's full accessible name. Not rendered — see above. */
  label: string;
  options: SelectOption[];
  value: string;
  /** Applied to the trigger. */
  className?: string;
  /** What the trigger shows. Defaults to the selected option's label. */
  children?: ReactNode;
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.id === value);

  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(key) => onChange(String(key ?? ""))}
    >
      {/* HeroUI's own trigger styling is BEM in `@layer components`, and
          Tailwind's utilities sit in a later layer, so these win the cascade —
          the same reshaping `components/layout/user-menu.tsx` does to a Button. */}
      <Select.Trigger
        className={`flex h-auto min-h-0 w-full items-center justify-between gap-1 rounded-lg border-0 bg-transparent px-1.5 py-1 text-left shadow-none hover:bg-default ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {children ?? selected?.label}
        </span>
        <Select.Indicator className="size-3.5 shrink-0" />
      </Select.Trigger>

      <Select.Popover className="min-w-60">
        <ListBox>
          {groupOptions(options).map((group) =>
            group.section === undefined ? (
              // Ungrouped options stay bare rather than getting an invented
              // heading, so a select with no sections renders exactly as before.
              group.options.map(renderOption)
            ) : (
              <ListBox.Section key={group.section}>
                <Header className="px-2 pb-1 pt-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  {group.section}
                </Header>
                {group.options.map(renderOption)}
              </ListBox.Section>
            ),
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function renderOption(option: SelectOption) {
  return (
    <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
      {/* Description under the label rather than beside it, so a long
          one truncates instead of pushing the indicator off the row. */}
      <span className="flex w-full min-w-0 flex-col overflow-hidden">
        <span className="truncate">
          {option.icon}
          {option.label}
        </span>
        {option.description ? (
          <span className="truncate text-xs text-muted">
            {option.description}
          </span>
        ) : null}
      </span>
      <ListBox.ItemIndicator />
    </ListBox.Item>
  );
}

/**
 * Contiguous runs sharing a section, in the order the caller gave them.
 *
 * Contiguous rather than gathered: the caller has already decided the order, and
 * re-grouping here would silently move an option away from where it was put. A
 * repeated section name in two separate runs is therefore two headings, which is
 * the caller's bug to fix and not something to paper over.
 */
function groupOptions(
  options: SelectOption[],
): { section: string | undefined; options: SelectOption[] }[] {
  const groups: { section: string | undefined; options: SelectOption[] }[] = [];

  for (const option of options) {
    const last = groups.at(-1);

    if (last && last.section === option.section) {
      last.options.push(option);
      continue;
    }

    groups.push({ section: option.section, options: [option] });
  }

  return groups;
}
