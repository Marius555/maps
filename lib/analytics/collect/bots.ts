import "server-only";

/**
 * Is this a machine?
 *
 * Unfiltered bot traffic does not make the numbers noisy, it makes them fiction:
 * a customer whose site is crawled nightly would read "40 views" and be looking
 * at one crawler. And because the beacon only fires from a real page that stayed
 * open long enough to hide, most crawlers never reach here at all — this catches
 * the ones that execute scripts, which are the previewers and the auditors.
 *
 * A substring list, not a parsed user-agent. The alternative is a dependency
 * with a data file that needs updating, for a question whose wrong answers cost
 * one row each. Anything that calls itself a bot is telling the truth; anything
 * that lies is indistinguishable from a visitor by any means available here.
 */
const SIGNATURES = [
  "bot",
  "crawl",
  "spider",
  "slurp",
  "headless",
  "phantom",
  "puppeteer",
  "playwright",
  "selenium",
  "lighthouse",
  "pagespeed",
  "monitor",
  "uptime",
  "preview",
  // Facebook, and every link unfurler that copied its user agent. It calls
  // itself "facebookexternalhit", which contains none of the words above.
  "externalhit",
  "scraper",
  "curl/",
  "wget",
  "python-requests",
  "http-client",
];

export function isBot(userAgent: string | null): boolean {
  // No user agent at all is not a browser. Every one of them sends one, and a
  // `sendBeacon` cannot suppress it.
  if (!userAgent) return true;

  const ua = userAgent.toLowerCase();

  return SIGNATURES.some((signature) => ua.includes(signature));
}
