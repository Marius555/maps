"use client";

import { FieldError, InputGroup, Label, TextField } from "@heroui/react";
import { Search } from "lucide-react";
import { useState } from "react";

import { GeocodeResultList } from "@/components/geocode/geocode-result-list";
import { ErrorMessage } from "@/components/ui/error-message";
import { IconButton } from "@/components/ui/icon-button";
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
 * props. The behaviour is identical in both places and the copy is not: in a
 * review row the hint points at the row's own actions, while the edit dialog now
 * has the map directly above this field and says the same thing there. A second
 * search field that agreed with this one on the day it was written is the drift
 * worth avoiding.
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
         * The lookup is a magnifier at the end of the box, not a button beside
         * it. They were always one control — type an address, look it up — and
         * the word "Find on map" spent a third of the row saying what the icon
         * says, which is a third of the row this form does not have now that the
         * address shares a line with the name.
         *
         * `InputGroup` rather than a hand-rolled flex row: its root reads
         * `TextFieldContext`, so it inherits the field's variant and invalid
         * state, and `InputGroup.Input` is still the TextField's own input —
         * which is what keeps `FieldError` associated with it for a screen
         * reader, and why the error lands under this line rather than inside it.
         */}
        <InputGroup fullWidth>
          <InputGroup.Input />
          <InputGroup.Suffix className="px-1">
            <IconButton
              label="Find this address on the map"
              icon={Search}
              variant="tertiary"
              isPending={search.isPending}
              isDisabled={value.trim().length < 3}
              onPress={run}
            />
          </InputGroup.Suffix>
        </InputGroup>

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
