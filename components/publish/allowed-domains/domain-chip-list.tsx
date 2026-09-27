"use client";

import { Chip } from "@heroui/react";
import { X } from "lucide-react";

/**
 * The allowed domains, one chip each, with a remove button on every one.
 *
 * The × is the tag picker's (`components/tags/tag-picker.tsx`): an 18px cross
 * whose `::after` overhangs it to a finger-sized target without growing the chip.
 */
export function DomainChipList({
  domains,
  onRemove,
}: {
  domains: readonly string[];
  onRemove: (domain: string) => void;
}) {
  if (domains.length === 0) {
    return (
      <p className="text-sm text-muted">
        No domains yet, so the map works on any site.
      </p>
    );
  }

  return (
    <ul aria-label="Allowed domains" className="flex flex-wrap gap-1.5">
      {domains.map((domain) => (
        <Chip<"li">
          key={domain}
          size="lg"
          variant="soft"
          className="max-w-full"
          render={(props) => <li {...props} />}
        >
          <Chip.Label className="min-w-0 truncate">{domain}</Chip.Label>
          <button
            type="button"
            className="relative -me-1 shrink-0 rounded-full p-0.5 text-muted transition-colors after:absolute after:-inset-[3px] after:content-[''] hover:bg-default-hover hover:text-foreground focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
            onClick={() => onRemove(domain)}
          >
            <X aria-hidden="true" className="size-3.5" />
            <span className="sr-only">Remove {domain}</span>
          </button>
        </Chip>
      ))}
    </ul>
  );
}
