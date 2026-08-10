/**
 * Opening hours: the shape, and the two things both build targets do with it.
 *
 * This lives in /packages/shared because the editor's place card and the embed's
 * popup must render the same week the same way. Two implementations that agree
 * today is exactly the drift CLAUDE.md §4 put this directory here to prevent.
 *
 * No dependencies, per that same rule — whatever this imports the embed inherits.
 * CLAUDE.md §3 nominates date-fns for opening-hours formatting, and that is fine
 * for the dashboard, but it cannot be used here and is not needed: "09:00–17:30"
 * is string slicing, and "open now" is two integer comparisons.
 *
 * One interval per day in v1. A split shift (09:00–13:00, 15:00–19:00) is common
 * enough that it will come up; the storage shape is an array so a second interval
 * can be added without a migration, but nothing reads a second one yet.
 */

/** `null` means closed that day. Times are 24-hour "HH:MM", local to the place. */
export type DayHours = { open: string; close: string } | null;

/** Exactly seven entries, index 0 = Monday. */
export type OpeningHours = DayHours[];

export const DAYS_IN_WEEK = 7;

export const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const DAY_LABELS_SHORT = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** An all-closed week, which is also what a malformed value degrades to. */
export function emptyHours(): OpeningHours {
  return Array.from({ length: DAYS_IN_WEEK }, () => null);
}

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** True when every day is closed — i.e. nothing worth rendering. */
export function isEmptyHours(hours: OpeningHours | null): boolean {
  return !hours || hours.every((day) => day === null);
}

/**
 * Parse the stored JSON column.
 *
 * Never throws and never returns a short array: a row written by an older version
 * of the app, or hand-edited in the Appwrite console, must not take down a list —
 * the same contract the repository mappers hold themselves to. Anything it cannot
 * make sense of becomes a closed day rather than an exception.
 */
export function parseHours(raw: unknown): OpeningHours | null {
  const value = typeof raw === "string" ? safeParse(raw) : raw;
  if (!Array.isArray(value)) return null;

  const week = emptyHours();

  for (let index = 0; index < DAYS_IN_WEEK; index += 1) {
    week[index] = toDay(value[index]);
  }

  return isEmptyHours(week) ? null : week;
}

function safeParse(raw: string): unknown {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function toDay(value: unknown): DayHours {
  if (!value || typeof value !== "object") return null;

  const { open, close } = value as { open?: unknown; close?: unknown };
  if (typeof open !== "string" || typeof close !== "string") return null;
  if (!isValidTime(open) || !isValidTime(close)) return null;

  return { open, close };
}

/** Serialise for storage. An all-closed week is stored as nothing at all. */
export function serialiseHours(hours: OpeningHours | null): string | null {
  return isEmptyHours(hours) ? null : JSON.stringify(hours);
}

/** "09:00–17:30", or "Closed". An en dash, not a hyphen — it is a range. */
export function formatDay(day: DayHours): string {
  return day ? `${day.open}–${day.close}` : "Closed";
}

/** Minutes since midnight, or -1 for a time this module would have rejected. */
function toMinutes(time: string): number {
  if (!isValidTime(time)) return -1;

  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/**
 * Is the place open at `at`?
 *
 * `at` is read in whatever timezone the runtime is in. That is the visitor's, not
 * the place's, which is wrong for a store in another country — but the alternative
 * is asking every customer to tag every location with an IANA zone, and v1 does
 * not have that field. Locations near the visitor, which is the case that matters
 * for "find nearest", are correct.
 *
 * A close time at or before the open time is treated as running past midnight, so
 * 22:00–02:00 is open at 01:00 rather than never open.
 */
export function isOpenNow(hours: OpeningHours | null, at: Date = new Date()): boolean {
  if (!hours) return false;

  // getDay() is Sunday-first; these arrays are Monday-first.
  const today = (at.getDay() + 6) % DAYS_IN_WEEK;
  const minutes = at.getHours() * 60 + at.getMinutes();

  if (isOpenOn(hours[today], minutes, false)) return true;

  // An overnight span belongs to the day it started on, so the small hours of
  // today are covered by yesterday's entry.
  const yesterday = (today + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK;

  return isOpenOn(hours[yesterday], minutes, true);
}

function isOpenOn(day: DayHours, minutes: number, spillover: boolean): boolean {
  if (!day) return false;

  const open = toMinutes(day.open);
  const close = toMinutes(day.close);
  if (open < 0 || close < 0) return false;

  const overnight = close <= open;

  if (spillover) return overnight && minutes < close;

  return overnight ? minutes >= open : minutes >= open && minutes < close;
}

/** Which index in a Monday-first week `at` falls on. */
export function dayIndex(at: Date = new Date()): number {
  return (at.getDay() + 6) % DAYS_IN_WEEK;
}
