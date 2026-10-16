import { ForbiddenError } from "@/lib/repositories/errors";

/**
 * Refuses a state-changing request that another website made the browser send.
 *
 * `sameSite: "strict"` keeps the session cookie off such a request, which
 * covers every signed-in route — but not the ones that run *before* there is a
 * session. A form on any site can POST `text/plain` to `/api/auth/login` (and
 * `parseBody` reads JSON whatever the content type says), and the response's
 * Set-Cookie signs the visitor into the attacker's account: login CSRF. The same
 * goes for signup, the OAuth exchange and the password reset.
 *
 * **`Sec-Fetch-Site` is the check**, because the browser sets it and no page
 * can: `cross-site` is refused, and everything else — `same-origin`,
 * `same-site` (cdn.pinglide.com), `none` (typed into the address bar) — passes.
 * It deliberately does not compare `Origin` with `Host` when the header is
 * there: what `Host` says behind Appwrite Sites' proxy is not ours to rely on,
 * and getting it wrong would refuse every write in production.
 *
 * `Origin` is the fallback, only for a browser too old to send `Sec-Fetch-Site`
 * (Safari before 16.4), compared against every name this request could have
 * been addressed to. A request with neither header is not a browser — the cron
 * function, a webhook, curl — and has no cookie to ride on anyway.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function assertSameOrigin(request: Request, appUrl?: string): void {
  if (SAFE_METHODS.has(request.method)) return;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) {
    if (fetchSite === "cross-site") throw new CrossSiteRequestError();
    return;
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new CrossSiteRequestError();
  }

  if (!ownHosts(request, appUrl).has(originHost)) throw new CrossSiteRequestError();
}

function ownHosts(request: Request, appUrl?: string): Set<string> {
  const hosts = new Set<string>();

  for (const header of ["host", "x-forwarded-host"]) {
    const value = request.headers.get(header);
    if (value) hosts.add(value.split(",")[0].trim());
  }

  for (const url of [request.url, appUrl]) {
    if (!url) continue;
    try {
      hosts.add(new URL(url).host);
    } catch {
      // An unparseable name names nothing; the others still count.
    }
  }

  return hosts;
}

export class CrossSiteRequestError extends ForbiddenError {
  constructor() {
    super("This request came from another website, so it was refused. Open Pinglide directly and try again.");
  }
}
