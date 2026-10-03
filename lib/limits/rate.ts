/**
 * **Every request-rate limit in the app, in one file.** How *often* somebody may
 * ask for something — the other table in this folder, `plans.ts`, is how *much*
 * they may keep or spend. Change a number here and deploy.
 *
 * Read by `lib/rate-limit/limiter.ts`. Most policies are applied by the route
 * wrappers in `lib/api/route.ts` rather than by the route itself, so a new route
 * is limited the day it is written: `withAuth` applies `read` to a GET and
 * `write` to anything else unless the route names a stricter policy, and
 * `withoutAuth` applies whatever its route names, keyed by IP.
 *
 * **These are friction against floods, not accounting**, and the numbers are set
 * so that nobody using the product by hand — or running a 3,000-row import —
 * ever meets one. The counters live in each server process's memory: a second
 * instance counts separately and a restart forgets. What must be exact is
 * already persisted elsewhere (the lookup allowance, `usage.repository.ts`; plan
 * quantities, counted from the rows themselves). The Cloudflare rule described
 * in docs/notes/limits.md is the layer that holds across instances.
 *
 * `per` says what a request is counted against:
 * - `user` — the signed-in account. Somebody with two tabs open is one caller.
 * - `ip` — for routes answered before there is an account (signup, login, the
 *   analytics beacon). One office behind one address shares a budget, which is
 *   why these are generous.
 * - `email` — the address a request is *about*, so one attacker walking many
 *   addresses and many attackers aiming at one are both slowed.
 * - `global` — one counter for everybody; a last line on the admin login only.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export type RatePolicy = {
  per: "user" | "ip" | "email" | "global";
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
};

export const RATE_LIMITS = {
  /* ---- Before sign-in, keyed by IP unless it says otherwise. ---- */

  /** Creating accounts. Each one sends a confirmation email. */
  signup: { per: "ip", limit: 5, windowMs: HOUR },
  /** Password guessing, from one address... */
  login: { per: "ip", limit: 20, windowMs: 15 * MINUTE },
  /** ...and against one account, from anywhere. */
  loginAccount: { per: "email", limit: 10, windowMs: 15 * MINUTE },
  /** Forgot-password and resend-confirmation: both mail a stranger on request. */
  authEmail: { per: "ip", limit: 10, windowMs: 15 * MINUTE },
  /** The same two, per address — three emails to one inbox per quarter hour. */
  authEmailAddress: { per: "email", limit: 3, windowMs: 15 * MINUTE },
  /** Links that arrive with a token: reset password, confirm address, Google return. */
  authToken: { per: "ip", limit: 20, windowMs: 15 * MINUTE },
  /** A published map's visitor beacon. One request per visitor session. */
  collect: { per: "ip", limit: 120, windowMs: MINUTE },
  /**
   * The pricing page asking what a discount code is worth. Generous for a
   * person (a page load, a few tries at a code), tight for a script guessing
   * codes — every answer says whether a code exists.
   */
  pricingOffer: { per: "ip", limit: 30, windowMs: 10 * MINUTE },
  /** The operator console, per address and for everybody at once. */
  adminLogin: { per: "ip", limit: 5, windowMs: 15 * MINUTE },
  adminLoginAll: { per: "global", limit: 20, windowMs: 15 * MINUTE },

  /* ---- Signed in, keyed by account. ---- */

  /** Default for every authenticated GET. */
  read: { per: "user", limit: 300, windowMs: MINUTE },
  /** Default for every authenticated POST, PATCH and DELETE. */
  write: { per: "user", limit: 240, windowMs: MINUTE },
  /**
   * Anything that reaches the geocoder or the router. Each is also metered
   * against the monthly allowance; this stops a script from reaching that
   * allowance in a minute.
   */
  metered: { per: "user", limit: 60, windowMs: MINUTE },
  /** Photo and logo uploads — up to 5MB each. */
  upload: { per: "user", limit: 30, windowMs: 10 * MINUTE },
  /** Writing a snapshot to the CDN. */
  publish: { per: "user", limit: 20, windowMs: 10 * MINUTE },
  /**
   * Starting "Sync now" on a linked Google Sheet. Only the first step counts —
   * the steps that continue a sync are ordinary writes.
   */
  sheetSync: { per: "user", limit: 10, windowMs: HOUR },
  /** Reading a Google Sheet to import it. */
  sheetImport: { per: "user", limit: 20, windowMs: 10 * MINUTE },
  /** Anything that calls the payment provider. */
  billing: { per: "user", limit: 10, windowMs: 10 * MINUTE },
  /** Changing the password, which checks the current one. */
  password: { per: "user", limit: 5, windowMs: 15 * MINUTE },
} as const satisfies Record<string, RatePolicy>;

export type RatePolicyName = keyof typeof RATE_LIMITS;

/**
 * How many metered requests one account may have running at once, per endpoint.
 *
 * The monthly allowance is checked before a request and recorded as it goes, so
 * requests running side by side can each pass the check before any of them has
 * recorded. Holding the bulk endpoints to one (or two) at a time bounds that
 * overlap to one batch. The single-lookup endpoints are left out: a search and a
 * pin drag landing together is normal, and one lookup of overlap is nothing.
 */
export const IN_FLIGHT_LIMITS = {
  /** An import's geocoding, 25 addresses a request, sent one after another. */
  geocodeBatch: 1,
  /** The route tool's sweep runs one at a time; a single pin may be asked meanwhile. */
  routable: 2,
} as const;

/*
 * Not here, because it is not counted in memory: the support form's one request
 * per minute per account is stored in the account's prefs so it holds across
 * instances (`lib/support/throttle.ts`).
 */
