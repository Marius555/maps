/**
 * The smallest a bar is drawn, as a share of its track.
 *
 * A €19 bill beside a $7,000 one is 0.3% of it, which is under two pixels on a
 * phone — a bar that vanishes reads as "free", and that is not the claim.
 *
 * **A module of its own, and that is not tidiness.** It used to live in
 * `cost/cost-bar.tsx`, which is `"use client"` — and every export of a client
 * module read from a *server* component is a client reference rather than the
 * value, so the comparison chart computed `Math.max(share, {reference}) * 100`,
 * got `NaN%`, dropped the width and drew every bar full length. React said
 * nothing: an invalid inline style is simply not applied. A plain module both
 * halves can import is the fix, and the reason this file exists.
 */
export const MIN_SHARE = 0.012;
