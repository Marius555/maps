/**
 * Optional accounts some specs need. A spec that needs one calls
 * `test.skip(!HAS_…, …)` so a run without it is a skip with a reason rather
 * than a failure — see e2e/README.md for what each unlocks.
 */
export const HAS_SECOND_ACCOUNT = !!(process.env.E2E_EMAIL_2 && process.env.E2E_PASSWORD_2);

export const HAS_ADMIN = !!(process.env.ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD);

/** Parsed the way the server parses them (lib/repositories/plan-limits.ts). */
const on = (raw: string | undefined) => !!raw && /^(1|true|yes)$/i.test(raw.trim());

/**
 * Development switches that make whole classes of check meaningless. With
 * `DISABLE_ALL_PLAN` every account reads as Pro, so a plan limit cannot be
 * hit; with `DISABLE_EMAIL_VERIFICATION` every account reads as confirmed.
 * Read from the same `.env` the dev server reads, so they agree as long as
 * the server was started after the last edit to it.
 */
export const PLANS_DISABLED = on(process.env.DISABLE_ALL_PLAN);
export const VERIFICATION_DISABLED = on(process.env.DISABLE_EMAIL_VERIFICATION);
