/**
 * Asks Cloudflare whether a Turnstile token is good.
 *
 * Three answers, not two, and the third is the reason this file exists rather
 * than a `fetch` inline in a route:
 *
 * - `pass` — Cloudflare says a person produced this token, on our sitekey.
 * - `fail` — Cloudflare says it is not good: missing, forged, expired or
 *   already spent. A form refreshes its widget after any failure, so a real
 *   person's second press carries a new token.
 * - `unavailable` — Cloudflare did not answer usefully: a timeout, a network
 *   error, a 5xx, or its own `internal-error`. **The caller lets that through.**
 *   It is the rule every address check on signup already follows
 *   (docs/notes/auth.md, "an address check that cannot decide must let the
 *   signup through"): a bot cannot make Cloudflare wobble, so failing open
 *   costs nothing against bots and failing closed would turn an upstream blip
 *   into a signup outage.
 *
 * **The action and hostname are not compared.** The sitekey is bound to
 * pinglide.com in Cloudflare's own hostname list, so a token can only be minted
 * on our pages; and Cloudflare's test keys answer `action: "test"` and
 * `hostname: "localhost"` whatever was asked, so comparing either would refuse
 * every signup in development for no gain in production.
 *
 * Pure apart from `fetch`, which is injected so the mapping is tested without
 * the network (verify.test.ts).
 */

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's own maximum. Anything longer is not a token. */
const MAX_TOKEN_LENGTH = 2048;

/** Long enough for a slow answer, short enough to sit inside a signup request. */
const TIMEOUT_MS = 5_000;

export type TurnstileVerdict = "pass" | "fail" | "unavailable";

type SiteverifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export async function checkTurnstile(input: {
  secret: string;
  token: string | null;
  ip?: string;
  fetchImpl?: typeof fetch;
}): Promise<TurnstileVerdict> {
  const token = input.token?.trim() ?? "";
  if (!token || token.length > MAX_TOKEN_LENGTH) return "fail";

  const body = new URLSearchParams({ secret: input.secret, response: token });
  // "unknown" is what `clientIp` answers with no address; sending it would be
  // worse than sending nothing.
  if (input.ip && input.ip !== "unknown") body.set("remoteip", input.ip);

  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error("Turnstile siteverify did not answer; letting the request through:", error);
    return "unavailable";
  }

  if (!response.ok) {
    console.error(
      `Turnstile siteverify answered ${String(response.status)}; letting the request through.`,
    );
    return "unavailable";
  }

  let result: SiteverifyResponse;
  try {
    result = (await response.json()) as SiteverifyResponse;
  } catch {
    console.error("Turnstile siteverify answered with something that is not JSON; letting the request through.");
    return "unavailable";
  }

  if (result.success === true) return "pass";

  const codes = result["error-codes"] ?? [];

  // Ours to fix, not the visitor's: a wrong or missing secret would otherwise
  // refuse every signup in silence. Logged loudly and let through, like an outage.
  if (codes.some((code) => code === "internal-error" || code.includes("secret"))) {
    console.error(
      `Turnstile siteverify could not check the token (${codes.join(", ")}); letting the request through.`,
    );
    return "unavailable";
  }

  return "fail";
}
