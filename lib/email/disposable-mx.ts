import "server-only";

/**
 * Is this mail server one that only throwaway services use?
 *
 * The vendored list (`lib/email/disposable.ts`) knows the domains a temp-mail
 * service had when it was generated, and those services register new ones every
 * day. What they rarely change is where the mail goes: hundreds of their domains
 * point at the same handful of servers. So a domain nobody has listed yet still
 * gives itself away through its MX records, which `lib/email/mx.ts` already
 * fetches for the mail-server check.
 *
 * **Curated by hand, and never the vendored list.** The obvious version — look
 * every exchange up in the 75,000 — refuses real customers: `yandex.net` is on
 * that list, because a few temp-mail services receive through Yandex, and so
 * does every business on Yandex 360. The same is true of Cloudflare Email
 * Routing (which this project's own support address uses), Google Workspace,
 * Zoho, Hostinger, OVH and the registrars' forwarders. A server belongs here
 * only if nothing but throwaway domains point at it.
 *
 * Built from a survey on 2026-10-04: MX records for 4,000 domains sampled across
 * the list, counted by server. Each entry below was seen serving listed
 * throwaway domains only, most of them dozens. A temp-mail service that receives
 * through a mainstream host (temp-mail.org is on Cloudflare) cannot be caught
 * this way at all — that is `lib/email/disposable-live.ts`'s job.
 *
 * A separate file from the generated one so `npm run build:disposable-domains`
 * never overwrites it.
 */

/** A server whose domain, or any subdomain of it, counts. */
const DOMAINS = new Set([
  // Listed as throwaway domains in their own right.
  "generator.email",
  "emailfake.com",
  "emlpro.com",
  "emltmp.com",
  "emlhub.com",
  "freeml.net",
  "spymail.one",
  "mimimail.me",
  "yomail.info",
  "mailpwr.com",
  "mailinator.com",
  "dropmail.me",
  "mail.tm",
  "trashmail.com",
  "spamgourmet.com",
  "papierkorb.me",
  "tempm.com",
  "gravityengine.cc",
  "powered.name",
  "vietxf.com",
  "tinyhost.shop",
  // Catch-all networks behind typo and burner domains (`166gmail.com`,
  // `47yahoo.com`, `50000z.com`), each server named `em4.` / `srv4.` / `mx4.`.
  "wabblywabble.com",
  "wallywatts.com",
  "beavis99.com",
  "beavis99.net",
  "unstablemail.com",
  "rejecthost.com",
  "catchservers.com",
  "catchservers.net",
  "recoverhost.com",
  "arrivalserver.com",
  "arrivalserver.net",
  "outsideserver.com",
  "mainnetmail.com",
  "mxcomet.com",
  "mxstorm.com",
  "hubblehost.com",
  "patternemail.com",
  "aerospaceemail.com",
  "inquirymailer.com",
  "brushemail.com",
  "stememail.com",
  "mb5p.com",
  "m1bp.com",
]);

/** A server matched exactly, where its parent domain may well serve others. */
const HOSTS = new Set(["email.chatgpt.org.uk"]);

export function isDisposableMailHost(exchange: string): boolean {
  const host = exchange.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  if (HOSTS.has(host)) return true;

  const labels = host.split(".");

  // The same parent walk as the domain check, down to two labels.
  for (let i = 0; i + 1 < labels.length; i += 1) {
    if (DOMAINS.has(labels.slice(i).join("."))) return true;
  }

  return false;
}
