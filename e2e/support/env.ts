/**
 * Optional accounts some specs need. A spec that needs one calls
 * `test.skip(!HAS_…, …)` so a run without it is a skip with a reason rather
 * than a failure — see e2e/README.md for what each unlocks.
 */
export const HAS_SECOND_ACCOUNT = !!(process.env.E2E_EMAIL_2 && process.env.E2E_PASSWORD_2);

/**
 * How the suite signs in to the operator console. The development admin
 * (`DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD`) first: `next dev` accepts it and a
 * production build ignores it (lib/admin/auth/config.ts). Against a production
 * build or a deployed site, `ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` instead — the
 * real admin's plain password, which is then on you to keep out of `.env`.
 */
export const ADMIN_LOGIN: { email: string; password: string } | null =
  process.env.DEV_ADMIN_EMAIL && process.env.DEV_ADMIN_PASSWORD
    ? { email: process.env.DEV_ADMIN_EMAIL, password: process.env.DEV_ADMIN_PASSWORD }
    : process.env.ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD
      ? { email: process.env.ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD }
      : null;

export const HAS_ADMIN = ADMIN_LOGIN !== null;

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
