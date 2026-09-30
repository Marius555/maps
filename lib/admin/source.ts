/**
 * Where a figure on the console comes from, so the operator can tell a number
 * a service handed us from one we tallied or modelled ourselves.
 *
 * - `api` — a service's own answer, used as it came: Appwrite's totals and
 *   user records, Lemon Squeezy's subscription state, Resend's reply to a send.
 * - `counted` — our own exact tally of real events: rows bucketed by day, the
 *   upstream request counter, the lookup meter.
 * - `estimate` — modelled or partial: revenue from list prices, breakdowns
 *   read from a capped sample.
 *
 * A plain module, not `"use client"`: server-rendered cards build these, and a
 * constant read through a client reference is not the constant (CLAUDE.md §0).
 */

export type SourceKind = "api" | "counted" | "estimate";

export type DataSource = {
  kind: SourceKind;
  /** One or two sentences: which service or table, and any caveat. */
  detail: string;
};

export const SOURCE_LABEL: Record<SourceKind, string> = {
  api: "API",
  counted: "Counted",
  estimate: "Estimate",
};

export function api(detail: string): DataSource {
  return { kind: "api", detail };
}

export function counted(detail: string): DataSource {
  return { kind: "counted", detail };
}

export function estimate(detail: string): DataSource {
  return { kind: "estimate", detail };
}

/** Counted, unless the read behind it was capped — then it is an estimate. */
export function countedUnless(capped: boolean, detail: string, cappedDetail: string): DataSource {
  return capped ? estimate(`${detail} ${cappedDetail}`) : counted(detail);
}
