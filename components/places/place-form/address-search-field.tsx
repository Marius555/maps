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
 */
export function AddressSearchField({
  mapId,
  value,
  error,
  onChange,
  onPick,
}: {
  mapId: string;
  value: string;
  error?: string;
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
        <Label>Address</Label>
        <Input placeholder="Gedimino pr. 9, Vilnius" />
        {/* Inside the field, not a paragraph beside it: this is what associates
            the message with the input for a screen reader. */}
        {error ? <FieldError>{error}</FieldError> : null}
      </TextField>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          isPending={search.isPending}
          isDisabled={value.trim().length < 3}
          onPress={run}
        >
          Find on map
        </Button>
        <span className="text-xs text-muted">
          Or drag the pin on the map to place it exactly.
        </span>
      </div>

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
