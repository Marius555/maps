"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { Plus, Search, X } from "lucide-react";
import { useState } from "react";

import { GeocodeResultList } from "@/components/geocode/geocode-result-list";
import { ErrorMessage } from "@/components/ui/error-message";
import { IconButton } from "@/components/ui/icon-button";
import type { GeocodeCandidate } from "@/lib/geocoding/types";
import { useGeocodeSearch } from "@/lib/query/geocode";

const MIN_QUERY = 3;

/**
 * Find an address on the map.
 *
 * This is the editor's own search, and it geocodes — which the embed's search
 * deliberately does not. The difference is CLAUDE.md §2: the embed runs in a
 * visitor's browser, where a metered lookup per keystroke is the business model
 * broken, while this runs in the dashboard for the map's owner. So the box in the
 * preview filters the map's own locations, and this one finds places on Earth.
 * They look similar and are not the same control.
 *
 * Picking a result moves the camera. The `+` beside it creates a location at that
 * exact match — which is also the keyboard route to adding one, now that "Add at
 * centre" is gone; clicking the map and dragging a pin out of the toolbar are
 * both pointer-only, and §8's quality floor asks for a form usable with a
 * keyboard alone.
 */
export function MapSearch({
  mapId,
  isAddDisabled,
  onPick,
  onAdd,
}: {
  mapId: string;
  /** True at the plan's place limit — finding still works, adding does not. */
  isAddDisabled?: boolean;
  onPick: (candidate: GeocodeCandidate) => void;
  onAdd: (candidate: GeocodeCandidate) => void;
}) {
  const search = useGeocodeSearch(mapId);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null);

  const isTooShort = query.trim().length < MIN_QUERY;

  const run = async () => {
    if (isTooShort) return;

    try {
      setCandidates(await search.mutateAsync({ address: query }));
    } catch {
      // Rendered from the mutation's error below.
    }
  };

  const clear = () => {
    setQuery("");
    setCandidates(null);
    search.reset();
  };

  return (
    <div className="pointer-events-auto w-full max-w-[calc(100%-3rem)] sm:w-72">
      {/*
       * The focus ring belongs to the whole bar, not to the input inside it.
       * HeroUI paints its own on the `<input>` element, which stopped dead at
       * the text's right edge and left Clear and Find sitting outside a ring
       * that was supposedly showing what had focus — one control drawn as two.
       * So the panel takes the ring when it contains a focused input, and the
       * input's own is suppressed below.
       */}
      <div className="rounded-xl border border-border bg-surface p-1 shadow-sm has-[input:focus]:ring-2 has-[input:focus]:ring-focus">
        <div className="flex items-center gap-1">
          <TextField
            fullWidth
            aria-label="Find an address"
            value={query}
            onChange={setQuery}
            // Enter submits the search rather than the page. This panel is not
            // inside a form today, and it must not start behaving differently if
            // one is ever wrapped around it.
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void run();
            }}
          >
            {/* Visually hidden: the placeholder and the icon already say what the
                field is, and a label above it would double the toolbar's height. */}
            <Label className="sr-only">Find an address</Label>
            <Input
              placeholder="Find an address"
              className="border-0 shadow-none focus:ring-0 data-focused:ring-0"
            />
          </TextField>

          {query ? (
            <Button
              size="sm"
              variant="tertiary"
              aria-label="Clear search"
              onPress={clear}
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          ) : null}

          <Button
            size="sm"
            variant="secondary"
            aria-label="Find"
            isPending={search.isPending}
            isDisabled={isTooShort}
            onPress={run}
          >
            <Search aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>

      {/*
       * Results hang below the field on their own surface rather than inside the
       * panel, so a long list scrolls instead of growing the toolbar down over
       * the map. Capped, because five matches on a short map panel is most of it.
       */}
      {search.error || candidates ? (
        <div className="mt-1 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-sm">
          {search.error ? <ErrorMessage error={search.error} /> : null}

          <GeocodeResultList
            candidates={candidates}
            emptyMessage="No matches. Try adding a city or postcode."
            /*
             * A `+` the size of the line it sits on, not a button beside the
             * match. "Add here" was a word-and-a-half of chrome taking a third
             * of a 288px panel away from the address, which is the one thing
             * the row exists to show. The hit area is padded back out to a
             * comfortable size with a transparent `::after`, so shrinking the
             * control does not shrink the target (§8).
             */
            action={(candidate) => (
              <IconButton
                label="Add a location here"
                icon={Plus}
                variant="primary"
                iconClassName="size-3"
                className="relative size-4 min-w-0 rounded-md p-0 after:absolute after:-inset-2 after:content-['']"
                isDisabled={isAddDisabled}
                onPress={() => {
                  onAdd(candidate);
                  clear();
                }}
              />
            )}
            onPick={onPick}
          />
        </div>
      ) : null}
    </div>
  );
}
