import { isValidTime } from "@/packages/shared/hours";

/** Minutes between one offered time and the next. */
const STEP_MINUTES = 30;

const MINUTES_IN_DAY = 24 * 60;

/**
 * The times the picker offers: "00:00", "00:30", … "23:30".
 *
 * Half-hours rather than every minute, because a list of 1,440 rows is not a
 * picker — it is a search problem — and opening hours are kept on the half hour
 * almost without exception. Anything off-slot is still typable in the segments
 * beside it, so the list can be short without being a limit.
 */
export const TIME_SLOTS: string[] = Array.from(
  { length: MINUTES_IN_DAY / STEP_MINUTES },
  (_, index) => fromMinutes(index * STEP_MINUTES),
);

/**
 * The slot nearest a stored time, for scrolling the list to roughly where the
 * user already is.
 *
 * A stored time need not be on a slot — a shop opening at 09:37 is perfectly
 * legal — and a picker that opens at midnight for it makes the user scroll past
 * twenty rows to reach their own morning. Nearest rather than preceding so that
 * 09:59 lands on 10:00, which is the row a hand reaching for it expects.
 *
 * Ties round up, and a value the pattern rejects falls back to the first slot:
 * this only decides where a list is scrolled, so being wrong costs a scroll.
 */
export function nearestSlot(value: string): string {
  if (!isValidTime(value)) return TIME_SLOTS[0];

  const [hours, minutes] = value.split(":").map(Number);
  const step = Math.round((hours * 60 + minutes) / STEP_MINUTES);

  // 23:45 rounds up to 24:00, which is not a slot — it is tomorrow. Clamped
  // rather than wrapped: the list would otherwise jump to the far end.
  return TIME_SLOTS[Math.min(step, TIME_SLOTS.length - 1)];
}

function fromMinutes(total: number): string {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
