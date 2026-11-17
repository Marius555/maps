/**
 * Set up the Stripe account the app sells through: the four plans as products
 * and prices, the webhook, and the customer portal.
 *
 * - `npm run setup:stripe` — create whatever is missing, point the webhook at
 *   `${APP_URL}/api/webhooks/billing`, and print the endpoint's secret when it
 *   is new (writing it into `.env` only when `.env` has none).
 * - `npm run setup:stripe https://pinglide.com` — that origin instead of
 *   `APP_URL`: the production webhook from a development `.env`.
 * - `dry-run` — say what it would do and change nothing.
 * - `verify` — read only: check the four prices behind the lookup keys, the
 *   webhook and `.env` against what the app expects, and exit non-zero on any
 *   disagreement, so it can gate a deploy. It writes no file and touches no
 *   object; that is guaranteed by where it sits in this script, not by a flag
 *   checked in several places.
 *
 * Options are plain words (`npm run setup:stripe verify https://pinglide.com`)
 * because PowerShell eats the `--` that `--verify` would need — see `flag`.
 * The `--verify`, `--dry-run` and `--app-url <origin>` forms still work in bash.
 *
 * Idempotent, and to be run **twice over the account's life**: once with the
 * test key and again with the live key, because test and live mode hold
 * separate products, prices and webhooks and the key decides which you see.
 *
 * ## How the app finds a plan
 *
 * By **lookup key**, never by an id pasted into the environment
 * (`lib/billing/stripe-prices.ts`). Changing a price is therefore a new price
 * on the same product, made here with `transfer_lookup_key`, and no deploy.
 * One product per plan and cadence, because a coupon can be limited to products
 * but not to prices, and the discount console offers "Pro yearly only".
 *
 * ## Managed Payments
 *
 * Every product carries an eligible tax code (`txcd_10103001`, SaaS for
 * business use) — Stripe refuses to sell a product without one through Managed
 * Payments. Prices are tax-**inclusive**: the €19 on the pricing page is what a
 * buyer pays, VAT included. Switch Managed Payments on in the Dashboard first
 * (Settings → Managed Payments); nothing here can.
 *
 * ## The webhook secret is shown once
 *
 * Stripe returns a webhook's signing secret only when the endpoint is created.
 * So this prints it then, and writes `STRIPE_WEBHOOK_SECRET` into `.env` only
 * when `.env` has none — in development `.env` holds the `stripe listen` secret. An endpoint that
 * already exists with no secret in `.env` is reported, not recreated: reveal its
 * secret in the Dashboard (Developers → Webhooks), or delete the endpoint and
 * run this again. Rotating silently would leave ours and theirs disagreeing and
 * every webhook 401ing, which reads as a broken endpoint.
 *
 * Local development does not use this endpoint at all: `stripe listen
 * --forward-to localhost:3000/api/webhooks/billing` prints a secret of its own
 * for `.env` (docs/notes/billing.md, "Webhooks in development").
 */

import { readFileSync, writeFileSync } from "node:fs";

import Stripe from "stripe";

/*
 * Every option is also a plain word: `npm run setup:stripe verify`. That is not
 * style. **PowerShell strips a bare `--` itself**, so `npm run setup:stripe --
 * --verify` reaches npm as `--verify`, which npm 11 swallows as one of its own
 * settings and never passes on — and the script then does a full run instead of
 * a read-only check. A plain word is the one thing every shell and npm pass
 * through unchanged. The `--flag` forms still work from bash.
 */
const words = process.argv.slice(2);

function flag(name) {
  return words.includes(`--${name}`) || words.includes(name);
}

const dryRun = flag("dry-run");
const verify = flag("verify");

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY. Add it to .env and try again.");
  process.exit(1);
}

const stripe = new Stripe(key, { timeout: 20_000, maxNetworkRetries: 2 });
const mode = key.startsWith("sk_live_") ? "LIVE" : "test";

/**
 * Hand-kept in step with `lib/marketing/plans.ts` (what the page says) and
 * `lookupKeyFor` in `lib/billing/stripe-prices.ts` (how the app finds them).
 * Amounts in euro cents.
 */
const OFFERS = [
  { plan: "starter", cadence: "monthly", name: "Starter", amount: 1900 },
  { plan: "starter", cadence: "yearly", name: "Starter", amount: 19000 },
  { plan: "pro", cadence: "monthly", name: "Pro", amount: 3900 },
  { plan: "pro", cadence: "yearly", name: "Pro", amount: 39000 },
].map((offer) => ({ ...offer, lookupKey: `pinglide_${offer.plan}_${offer.cadence}` }));

const TAX_CODE = "txcd_10103001";
const TAX_BEHAVIOR = "inclusive";

/** Hand-kept in step with `BILLING_EVENTS` in `lib/billing/stripe.ts`. */
const WEBHOOK_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
];

/**
 * `--app-url https://pinglide.com` beats `APP_URL`, so pointing the webhook at
 * production needs no shell-specific `VAR=value` prefix (PowerShell has none).
 */
function appUrlFlag() {
  const index = words.indexOf("--app-url");
  // `--app-url https://…` from bash; a bare origin from any shell (see `flag`).
  const value = index !== -1 ? (words[index + 1] ?? "") : words.find((word) => /^https?:\/\//.test(word));
  if (value === undefined) return null;

  if (!/^https:\/\/[^/\s]+\/?$/.test(value)) {
    console.error(`The site address must be an https origin, like https://pinglide.com (got "${value}").`);
    process.exit(1);
  }
  return value;
}

const appUrl = (appUrlFlag() ?? process.env.APP_URL ?? "").replace(/\/+$/, "");
const webhookUrl = appUrl ? `${appUrl}/api/webhooks/billing` : null;
const publicWebhook = webhookUrl && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(webhookUrl);

function interval(cadence) {
  return cadence === "yearly" ? "year" : "month";
}

function euros(cents) {
  return `€${(cents / 100).toFixed(2)}`;
}

/** What is wrong with a price for an offer, or an empty list. */
function priceProblems(price, offer) {
  const problems = [];
  if (price.unit_amount !== offer.amount) problems.push(`amount ${euros(price.unit_amount ?? 0)}, expected ${euros(offer.amount)}`);
  if (price.currency !== "eur") problems.push(`currency ${price.currency}, expected eur`);
  if (price.recurring?.interval !== interval(offer.cadence) || (price.recurring?.interval_count ?? 1) !== 1) {
    problems.push(`billed every ${price.recurring?.interval_count ?? "?"} ${price.recurring?.interval ?? "?"}, expected ${interval(offer.cadence)}`);
  }
  if (price.tax_behavior !== TAX_BEHAVIOR) problems.push(`tax ${price.tax_behavior ?? "unspecified"}, expected ${TAX_BEHAVIOR}`);
  return problems;
}

async function priceFor(offer) {
  const list = await stripe.prices.list({
    lookup_keys: [offer.lookupKey],
    active: true,
    expand: ["data.product"],
    limit: 1,
  });
  return list.data[0] ?? null;
}

async function findWebhook() {
  if (!webhookUrl) return null;
  for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) {
    if (endpoint.url === webhookUrl) return endpoint;
  }
  return null;
}

console.log(`Stripe account, ${mode} mode.\n`);

/* ------------------------------------------------------------------ *
 * --verify: read only.
 * ------------------------------------------------------------------ */

if (verify) {
  const problems = [];

  for (const offer of OFFERS) {
    const price = await priceFor(offer);

    if (!price) {
      problems.push(`${offer.lookupKey}: no active price has this lookup key`);
      console.log(`  MISSING ${offer.lookupKey}`);
      continue;
    }

    const wrong = priceProblems(price, offer);
    const product = typeof price.product === "object" ? price.product : null;
    if (product && !("deleted" in product && product.deleted) && product.tax_code !== TAX_CODE) {
      const code = typeof product.tax_code === "string" ? product.tax_code : (product.tax_code?.id ?? "none");
      wrong.push(`product tax code ${code}, expected ${TAX_CODE}`);
    }

    if (wrong.length > 0) {
      problems.push(`${offer.lookupKey}: ${wrong.join("; ")}`);
      console.log(`  WRONG   ${offer.lookupKey}  ${wrong.join("; ")}`);
    } else {
      console.log(`  ok      ${offer.lookupKey}  ${euros(offer.amount)} / ${offer.cadence}  (${price.id})`);
    }
  }

  if (!(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim()) {
    problems.push("STRIPE_WEBHOOK_SECRET is not set: the webhook refuses everybody");
  }

  if (publicWebhook) {
    const endpoint = await findWebhook();
    if (!endpoint) {
      problems.push(`no webhook endpoint at ${webhookUrl}`);
    } else {
      const missing = WEBHOOK_EVENTS.filter((event) => !endpoint.enabled_events.includes(event) && !endpoint.enabled_events.includes("*"));
      if (missing.length > 0) problems.push(`webhook is not subscribed to ${missing.join(", ")}`);
      if (endpoint.status !== "enabled") problems.push(`webhook is ${endpoint.status}`);
    }
  } else {
    console.log(`\n  (APP_URL is ${appUrl || "unset"}, so the webhook endpoint was not checked.)`);
  }

  if (problems.length > 0) {
    console.error(`\nStripe disagrees with what the app expects on ${problems.length} point(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error("\nRun npm run setup:stripe to fix what it can.");
    process.exit(1);
  }

  console.log("\nEverything the app expects is in place.");
  process.exit(0);
}

/* ------------------------------------------------------------------ *
 * Products and prices.
 * ------------------------------------------------------------------ */

const say = (line) => console.log(dryRun ? `  would ${line}` : `  ${line}`);

for (const offer of OFFERS) {
  const existing = await priceFor(offer);

  if (existing && priceProblems(existing, offer).length === 0) {
    console.log(`  ok      ${offer.lookupKey}  ${euros(offer.amount)} / ${offer.cadence}`);
    continue;
  }

  let productId = existing && typeof existing.product === "object" ? existing.product.id : null;

  if (!productId) {
    // A product left from an earlier run, found by its metadata.
    for await (const product of stripe.products.list({ active: true, limit: 100 })) {
      if (product.metadata?.pinglide_offer === offer.lookupKey) {
        productId = product.id;
        break;
      }
    }
  }

  if (!productId) {
    say(`create product "Pinglide ${offer.name} (${offer.cadence})"`);
    if (!dryRun) {
      const product = await stripe.products.create({
        name: `Pinglide ${offer.name} (${offer.cadence})`,
        tax_code: TAX_CODE,
        metadata: { pinglide_offer: offer.lookupKey },
      });
      productId = product.id;
    }
  } else if (!dryRun) {
    await stripe.products.update(productId, { tax_code: TAX_CODE });
  }

  if (existing) {
    console.log(`  WRONG   ${offer.lookupKey}  ${priceProblems(existing, offer).join("; ")}`);
    say(`move ${offer.lookupKey} to a new price (the old one is archived)`);
  } else {
    say(`create price ${offer.lookupKey}  ${euros(offer.amount)} / ${offer.cadence}`);
  }

  if (!dryRun) {
    await stripe.prices.create({
      product: productId,
      currency: "eur",
      unit_amount: offer.amount,
      recurring: { interval: interval(offer.cadence), interval_count: 1 },
      tax_behavior: TAX_BEHAVIOR,
      lookup_key: offer.lookupKey,
      transfer_lookup_key: true,
    });
    if (existing) await stripe.prices.update(existing.id, { active: false });
  }
}

/* ------------------------------------------------------------------ *
 * Customer portal: the card, the billing details and past invoices.
 * Cancelling and plan changes stay in the app (Settings → Billing).
 * ------------------------------------------------------------------ */

const portalSettings = {
  default_return_url: appUrl ? `${appUrl}/billing/return` : undefined,
  features: {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ["email", "tax_id"] },
    subscription_cancel: { enabled: false },
    subscription_update: { enabled: false },
  },
};

{
  const configs = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
  const current = configs.data[0];

  say(current ? `update the default customer portal (${current.id})` : "create the default customer portal");

  if (!dryRun) {
    try {
      if (current) await stripe.billingPortal.configurations.update(current.id, portalSettings);
      else await stripe.billingPortal.configurations.create(portalSettings);
    } catch (error) {
      console.warn(`  The portal could not be configured (${error.message}). Set it in the Dashboard: Settings → Billing → Customer portal.`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Webhook.
 * ------------------------------------------------------------------ */

if (!publicWebhook) {
  console.log(
    `\nAPP_URL is ${appUrl || "unset"}, which Stripe cannot reach, so no webhook endpoint was touched.\n` +
      `  For development: stripe listen --events ${WEBHOOK_EVENTS.join(",")} --forward-to localhost:3000/api/webhooks/billing\n` +
      "    and put the whsec_… it prints into .env as STRIPE_WEBHOOK_SECRET.\n" +
      "  For the live site: npm run setup:stripe https://pinglide.com\n" +
      "    and put the whsec_… it prints on the Appwrite Site.",
  );
  process.exit(0);
}

const endpoint = await findWebhook();

if (endpoint) {
  say(`update the webhook at ${webhookUrl}`);
  if (!dryRun) await stripe.webhookEndpoints.update(endpoint.id, { enabled_events: WEBHOOK_EVENTS, disabled: false });

  if (!(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim()) {
    console.warn(
      "\n  STRIPE_WEBHOOK_SECRET is not in .env, and Stripe only returns it when an endpoint is made.\n" +
        "  Reveal it in the Dashboard (Developers → Webhooks → this endpoint), or delete the endpoint and run this again.",
    );
  }
  process.exit(0);
}

say(`create the webhook at ${webhookUrl}`);
if (dryRun) process.exit(0);

const created = await stripe.webhookEndpoints.create({
  url: webhookUrl,
  enabled_events: WEBHOOK_EVENTS,
  description: "Pinglide subscriptions",
});

/*
 * The new endpoint's secret goes on the Appwrite Site. It is written into `.env`
 * only when `.env` has none: in development `.env` holds the `stripe listen`
 * secret, which the local server needs and a production endpoint's would break.
 * Either way it is printed, because Stripe shows it once.
 */
if ((process.env.STRIPE_WEBHOOK_SECRET ?? "").trim()) {
  console.log(
    "\nCreated the webhook. Its signing secret, shown once — put it on the Appwrite Site as STRIPE_WEBHOOK_SECRET:\n\n" +
      `  ${created.secret}\n\n` +
      ".env already has a STRIPE_WEBHOOK_SECRET (the stripe listen one, in development), so it was left alone.",
  );
  process.exit(0);
}

let env;
try {
  env = readFileSync(".env", "utf8");
} catch {
  console.error(`No .env file found to write it into. The secret, shown once:\n  ${created.secret}`);
  process.exit(1);
}

/*
 * In place where it exists, appended where it does not, with whitespace around
 * the name normalised: dotenv trims names, so `NAME =…` works at runtime and is
 * invisible to every tool that greps `^NAME=`.
 */
const line = `STRIPE_WEBHOOK_SECRET=${created.secret}`;
const pattern = /^[ \t]*STRIPE_WEBHOOK_SECRET[ \t]*=.*$/m;
env = pattern.test(env) ? env.replace(pattern, line) : `${env.replace(/\n*$/, "")}\n${line}\n`;
writeFileSync(".env", env, "utf8");

console.log("\nWrote STRIPE_WEBHOOK_SECRET to .env. Put the same value on the Appwrite Site.");
