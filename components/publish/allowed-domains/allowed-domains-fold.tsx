"use client";

import { useRef, useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { PropertyFold } from "@/components/ui/properties/property-fold";
import { PropertyFolds } from "@/components/ui/properties/property-folds";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap } from "@/lib/repositories/types";
import { MAX_ALLOWED_DOMAINS } from "@/lib/validation/domain.schema";
import { DomainChipList } from "./domain-chip-list";
import { DomainInput } from "./domain-input";

/**
 * Where the map is allowed to run, folded shut until somebody asks.
 *
 * Most owners never set this, so it is a fold with the answer in its title
 * ("anywhere", or how many) rather than a form open under the snippet.
 *
 * **Every add and every remove saves at once.** The textarea this replaced had
 * its own Save button because a half-typed list is not a state to save — a
 * debounced write would lock a map to `exampl` on the way to `example.com`. That
 * objection is gone: only a complete domain that has already passed
 * `domainSchema` ever reaches the list, so there is nothing half-finished to
 * guard against, and a Save button would only be a way to lose the change.
 *
 * The local list is the base for each write, never the server's reply (the
 * CLAUDE.md rule for optimistic writes): two quick adds each send the list as
 * the owner sees it, and a late reply to the first cannot drop the second. A
 * failure reverts to the last list the server confirmed, but only if no newer
 * write has been sent since.
 */
export function AllowedDomainsFold({ map }: { map: AppMap }) {
  const updateMap = useUpdateMap(map.id);
  const [domains, setDomains] = useState<string[]>(map.allowedDomains);
  const confirmed = useRef<string[]>(map.allowedDomains);
  const latest = useRef(0);

  const save = async (next: string[]) => {
    setDomains(next);
    const write = ++latest.current;

    try {
      const saved = await updateMap.mutateAsync({ allowedDomains: next });
      confirmed.current = saved.allowedDomains;
    } catch {
      // `updateMap.error` carries the message; the list goes back to what is
      // actually stored rather than showing a domain that was never saved.
      if (write === latest.current) setDomains(confirmed.current);
    }
  };

  const title =
    domains.length === 0
      ? "Allowed domains · Anywhere"
      : `Allowed domains · ${domains.length} of ${MAX_ALLOWED_DOMAINS}`;

  return (
    <PropertyFolds>
      <PropertyFold id="allowed-domains" title={title}>
        <div className="space-y-3">
          {updateMap.error ? <ErrorMessage error={updateMap.error} /> : null}

          <DomainChipList
            domains={domains}
            onRemove={(domain) => save(domains.filter((d) => d !== domain))}
          />

          <DomainInput
            existing={domains}
            onAdd={(added) => save([...domains, ...added])}
          />

          {/* One line where there were two paragraphs (2026-11-07). "Empty is
              anywhere" is already the fold's title; what is left is the rule
              and the honest limit — this is anti-abuse, not security (§7). */}
          <p className="text-pretty text-xs text-muted">
            Only these sites can show the map, subdomains included. It deters
            copying; the map file itself stays public.
          </p>
        </div>
      </PropertyFold>
    </PropertyFolds>
  );
}
