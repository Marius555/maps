"use client";

import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";

import { GeocodeResultList } from "@/components/geocode/geocode-result-list";
import { ErrorMessage } from "@/components/ui/error-message";
import type { GeocodeCandidate } from "@/lib/geocoding/types";
import { useGeocodeSearch } from "@/lib/query/geocode";

/**
 * Address entry with search-on-submit.
 *
 * One request per deliberate submit, and the results are a list the user picks
 * from — never applied automatically. Picking is what moves the pin, so a wrong
 * guess costs nothing (CLAUDE.md §7).
 *
 * Shared with the import review step, which is why the label and the hint are
 * props. The behaviour is identical in both places and the copy is not: in the
 * edit dialog the hint points at the map beside the field, while in a review row
 * it points at the row's own actions. A second search field that agreed with
 * this one on the day it was written is the drift worth avoiding.
 */
export function AddressSearchField({
  mapId,
  value,
  error,
  label = "Address",
  hideLabel,
  hint = "Or drag the pin on the map to place it exactly.",
  onChange,
  onPick,
}: {
  mapId: string;
  value: string;
  error?: string;
  label?: string;
  /** Kept in the accessibility tree, out of the layout — for dense lists. */
  hideLabel?: boolean;
  /** `null` for no hint at all. */
  hint?: string | null;
  onChange: (address: string) => void;
  onPick: (candidate: GeocodeCandidate) => void;
}) {
  const search = useGeocodeSearch(mapId);
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null);

  const run = async () => {
    if (value.trim().length < 3) return;

    try {
      setCandidates(await search.mutateAsync({ address: value }));
    } catch {
      // Rendered from the mutation's error below.
    }
  };

  return (
    <div className="space-y-2">
      <TextField
        fullWidth
        isInvalid={Boolean(error)}
        value={value}
        onChange={onChange}
        // Enter inside a nested field would otherwise submit the whole place form.
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          void run();
        }}
      >
        <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>

        {/*
         * The button sits on the input's own line, inside the field rather than
         * under it. They are one control — type an address, look it up — and a
         * full-width box with a small button orphaned on the next row spent a
         * whole row of the dialog saying so.
         *
         * Nested rather than a sibling flex row so `FieldError` stays a child of
         * `TextField`: that is what associates the message with the input for a
         * screen reader, and it is also why the error goes *under* this line
         * instead of inside it.
         */}
        <div className="flex items-center gap-2">
          <Input className="min-w-0 flex-1" />
          <Button
            className="shrink-0"
            variant="secondary"
            isPending={search.isPending}
            isDisabled={value.trim().length < 3}
            onPress={run}
          >
            Find on map
          </Button>
        </div>

        {error ? <FieldError>{error}</FieldError> : null}
      </TextField>

      {hint ? <p className="text-xs text-muted">{hint}</p> : null}

      {search.error ? <ErrorMessage error={search.error} /> : null}

      <GeocodeResultList
        candidates={candidates}
        emptyMessage="No matches for that address. Try adding a city or postcode, or drag the pin instead."
        onPick={(candidate) => {
          onPick(candidate);
          setCandidates(null);
        }}
      />
    </div>
  );
}
