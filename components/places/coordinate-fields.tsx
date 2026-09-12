"use client";

import { FieldError, Input, Label, TextField } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { parseCoordinate } from "@/lib/import/coordinates";
import { isValidLngLat, roundCoord } from "@/lib/map/geo";

/**
 * Latitude and longitude, typed.
 *
 * Both screens that own a pin used to show its position as text and nothing
 * else, on the reasoning that nobody edits a latitude by hand. Mostly true — and
 * completely wrong in the one case that matters, which is a pin the geocoder put
 * in the wrong country. Then the coordinates are the only thing the user has:
 * they can read the right ones off any map and there is no other way in. The
 * review step had no pin to drag for an unplaced row, and the edit dialog has no
 * map at all, so "drag it instead" was advice with nowhere to follow it.
 *
 * The text is local state rather than a formatted prop, because a controlled
 * numeric field cannot be typed into — "-" and "40." are both unparseable
 * halfway to a real value, and reformatting on every keystroke moves the caret.
 * The position is only pushed out when both halves parse to a real point, so an
 * in-progress edit never moves the pin somewhere the user didn't mean.
 *
 * `parseCoordinate` rather than `Number`: it is the same reader the import uses,
 * so a pasted "54,687" means 54.687 here exactly as it does in a spreadsheet
 * column, instead of silently becoming 54.
 */
export function CoordinateFields({
  lat,
  lng,
  isDisabled,
  className = "grid gap-3 @md:grid-cols-2",
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  isDisabled?: boolean;
  /**
   * The pair's own layout, for a caller whose row is not a half-and-half split.
   *
   * Defaulted to the place form's own layout, which is where this pair began.
   * **That default is a container query and therefore assumes a container** —
   * the dialog body declares one (place-form.tsx), and a caller outside one gets
   * a single column, which is the safe answer rather than a broken one. It was a
   * `sm:` viewport query and split in two inside a 448px dialog, which is the
   * width the dialog actually had.
   *
   * The import review row overrides it either way: a latitude is nine characters
   * and its box does not need a quarter of a full-width table row.
   */
  className?: string;
  onChange: (coords: { lat: number; lng: number }) => void;
}) {
  const [text, setText] = useState(() => ({
    lat: format(lat),
    lng: format(lng),
  }));

  /*
   * What we last agreed the position was.
   *
   * Re-seeding the boxes whenever the props change would fight the user on every
   * keystroke, since our own `onChange` changes them. Comparing against the last
   * value we accepted means the boxes only refill when the move came from
   * somewhere else — a dragged pin, a picked address match.
   */
  const applied = useRef({ lat, lng });

  useEffect(() => {
    if (applied.current.lat === lat && applied.current.lng === lng) return;

    applied.current = { lat, lng };
    setText({ lat: format(lat), lng: format(lng) });
  }, [lat, lng]);

  const commit = (next: { lat: string; lng: string }) => {
    setText(next);

    const parsedLat = parseCoordinate(next.lat);
    const parsedLng = parseCoordinate(next.lng);
    if (parsedLat === null || parsedLng === null) return;
    if (!isValidLngLat(parsedLng, parsedLat)) return;

    const coords = { lat: roundCoord(parsedLat), lng: roundCoord(parsedLng) };
    applied.current = coords;
    onChange(coords);
  };

  return (
    <div className={className}>
      <CoordinateField
        label="Latitude"
        limit={90}
        value={text.lat}
        isDisabled={isDisabled}
        onChange={(value) => commit({ ...text, lat: value })}
      />
      <CoordinateField
        label="Longitude"
        limit={180}
        value={text.lng}
        isDisabled={isDisabled}
        onChange={(value) => commit({ ...text, lng: value })}
      />
    </div>
  );
}

/**
 * No placeholder, deliberately.
 *
 * These boxes used to read "52.5200" and "13.4050" when empty. Both are real
 * coordinates in Berlin and both look exactly like a filled field, so a row the
 * import could not place showed a full pair of numbers next to an error saying
 * it had none. The label says what the box is for; anything greyed out inside it
 * is a value the user has to disprove.
 */
function CoordinateField({
  label,
  limit,
  value,
  isDisabled,
  onChange,
}: {
  label: string;
  limit: number;
  value: string;
  isDisabled?: boolean;
  onChange: (value: string) => void;
}) {
  const error = errorFor(value, limit, label);

  return (
    <TextField
      fullWidth
      isDisabled={isDisabled}
      isInvalid={Boolean(error)}
      value={value}
      onChange={onChange}
    >
      <Label>{label}</Label>
      {/* `decimal`, not `numeric`: a minus sign is half of every western
          longitude and the numeric keypad has no key for one. */}
      <Input inputMode="decimal" className="tabular-nums" />
      {error ? <FieldError>{error}</FieldError> : null}
    </TextField>
  );
}

/**
 * Said while typing, so it has to tolerate a half-finished number.
 *
 * "-" and "" are on the way to a valid value, not wrong; only something that
 * parses to a real number outside the range, or doesn't parse at all, is.
 */
function errorFor(value: string, limit: number, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return null;

  const parsed = parseCoordinate(trimmed);
  if (parsed === null) return `${label} has to be a number.`;

  return Math.abs(parsed) > limit
    ? `${label} is between -${limit} and ${limit}.`
    : null;
}

function format(value: number | null): string {
  return value === null ? "" : String(value);
}
