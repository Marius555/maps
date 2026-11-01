/**
 * The request header a form puts its Turnstile token in.
 *
 * A header rather than a body field so the forms' Zod schemas stay exactly the
 * shapes their fields are — `signupSchema` is shared by the form and the server,
 * and a token is not something the person typed. A plain module, because the
 * client half (`lib/query/auth.ts`) and the server half
 * (`lib/turnstile/human-check.ts`) both need the name and only one of them may
 * import `server-only` code.
 */
export const TURNSTILE_HEADER = "x-turnstile-token";
