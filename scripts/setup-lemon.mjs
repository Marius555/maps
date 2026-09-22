import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

/**
 * Point the app at a Lemon Squeezy store: find the variants, write the ids into
 * `.env`, and configure the webhook.
 *
 * `npm run setup:lemon` — idempotent, and safe to re-run. Nothing here creates or
 * deletes a product; it reads what the store has and writes down what it found.
 *
 * ## Three modes
 *
 * - `npm run setup:lemon` — resolve the variants, write their ids into `.env`,
 *   configure the webhook.
 * - `--dry-run` — resolve and report what it would set. Writes nothing.
 * - `--verify` — compare what `.env` **already holds** against the store and exit
 *   non-zero on any disagreement. Reads no file, writes nothing, so it can gate a
 *   deploy.
 *
 * `--verify` exists because re-running this script is already its own fix, but
 * nothing forces the re-run — and a `.env` edited by hand is invisible until a
 * customer meets it. Both ways of getting it wrong have happened here: a
 * **product** id pasted where a variant id belongs (every checkout 404s, and every
 * webhook matches no plan), and one cadence's id pasted into both slots (the
 * yearly button quietly opens the monthly price).
 *
 * ## Why this exists rather than a list of steps in a README
 *
 * The store has to be configured **twice** — once in test mode and again in live
 * mode — because Lemon Squeezy keeps separate products for each and the API key
 * is what decides which set you are looking at. A checklist performed twice, the
 * second time under the pressure of going live, is a checklist that gets one
 * variant id wrong. Getting one wrong is not a visible failure: the checkout for
 * that one plan-and-cadence opens the *other* plan's price, and the first sign is
 * a customer paying €19 for Pro.
 *
 * ## What it cannot do
 *
 * **Products and variants can only be created in the dashboard.** The Lemon
 * Squeezy API is read-only for both — there is no POST for either — so this
 * script reports what is missing and stops. That is the one manual step and there
 * is no way around it.
 *
 * ## How a variant is matched to a plan
 *
 * By **price and interval**, never by name. A name is a thing somebody types, and
 * "Pinglide Starter (Monthly)" versus "Starter monthly" is a difference this
 * script should not have an opinion about. A price and a billing interval are
 * what the customer is actually agreeing to, they are what `lib/marketing/plans.ts`
 * publishes, and a mismatch between the two is exactly the error worth refusing
 * to guess past.
 */

const API = "https://api.lemonsqueezy.com/v1";
const MEDIA_TYPE = "application/vnd.api+json";

/**
 * The four things we sell, in the provider's own units.
 *
 * Prices are in cents because that is what the API reports, and they are written
 * here rather than imported from `lib/marketing/plans.ts` for the reason that
 * file's own docblock gives about duplication: this is a `.mjs` script that runs
 * outside the bundler, the same arrangement `PLANS` in `appwrite-schema.mjs` has.
 * `lib/marketing/plans.test.ts` holds the page to the repositories; this list is
 * held to the store by the run itself, which refuses on any mismatch.
 */
const WANTED = [
  { env: "LEMON_VARIANT_STARTER_MONTHLY", label: "Starter monthly", cents: 1900, interval: "month" },
  { env: "LEMON_VARIANT_STARTER_YEARLY", label: "Starter yearly", cents: 19000, interval: "year" },
  { env: "LEMON_VARIANT_PRO_MONTHLY", label: "Pro monthly", cents: 3900, interval: "month" },
  { env: "LEMON_VARIANT_PRO_YEARLY", label: "Pro yearly", cents: 39000, interval: "year" },
];

/** Every event the webhook handler knows about — `app/api/webhooks/billing`. */
const EVENTS = [
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_resumed",
  "subscription_paused",
  "subscription_unpaused",
  "subscription_payment_success",
  "subscription_payment_failed",
  "subscription_payment_recovered",
  "subscription_payment_refunded",
];

const dryRun = process.argv.includes("--dry-run");
const verify = process.argv.includes("--verify");

const apiKey = process.env.LEMON_API_KEY || process.env.LEMON_TEST_API_KEY;

if (!apiKey) {
  console.error(
    "Missing LEMON_API_KEY (or LEMON_TEST_API_KEY). Add it to .env and try again.",
  );
  process.exit(1);
}

async function call(path, { method = "GET", body } = {}) {
  const response = await fetch(API + path, {
    method,
    headers: {
      accept: MEDIA_TYPE,
      "content-type": MEDIA_TYPE,
      authorization: `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 400)}`);
  }

  return text ? JSON.parse(text) : {};
}

/** Read `.env` as lines, so the rewrite keeps comments, order and spacing. */
function readEnvFile() {
  try {
    return readFileSync(".env", "utf8");
  } catch {
    console.error("No .env file found. Create one first.");
    process.exit(1);
  }
}

/**
 * Set a variable in `.env`, in place where it exists and appended where it does
 * not.
 *
 * Whitespace around the name is normalised on the way past. That is not tidiness:
 * `dotenv` trims names when it loads them, so `LEMON_STORE_ID =…` works at
 * runtime and is invisible — and then every tool that greps `^LEMON_STORE_ID=`
 * silently finds nothing. This file has had that exact defect on nine variables.
 */
function setEnvVar(text, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^[ \\t]*${name}[ \\t]*=.*$`, "m");

  return pattern.test(text)
    ? text.replace(pattern, line)
    : `${text.replace(/\n*$/, "")}\n${line}\n`;
}

function euros(cents) {
  return `€${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

const store = await (async () => {
  const wanted = process.env.LEMON_STORE_ID;
  const { data } = await call("/stores");

  if (data.length === 0) {
    console.error("This account has no stores.");
    process.exit(1);
  }

  const found = wanted ? data.find((s) => s.id === String(wanted)) : data[0];

  if (!found) {
    console.error(
      `LEMON_STORE_ID is ${wanted}, which this key cannot see. Stores it can: ${data
        .map((s) => `${s.id} (${s.attributes.name})`)
        .join(", ")}`,
    );
    process.exit(1);
  }

  return found;
})();

console.log(
  `Store  ${store.id}  ${store.attributes.name}  ${store.attributes.currency}`,
);

if (store.attributes.currency !== "EUR") {
  console.warn(
    `  ! Store currency is ${store.attributes.currency}, but the plans are priced in euros.\n` +
      "    The checkout will convert, so what a customer pays will not be the number on /pricing.",
  );
}

const { data: variants } = await call("/variants");

/*
 * A published variant only. Lemon Squeezy auto-creates a hidden "default" variant
 * behind every single-variant product, and those are `status: "pending"` with the
 * product's own price — so on a store with one product per plan they would match
 * the price test and be written into `.env`, where they 404 at checkout.
 */
const sellable = variants.filter((v) => v.attributes.status !== "pending");

console.log(`Variants  ${sellable.length} sellable of ${variants.length} total\n`);

const resolved = [];
const missing = [];

for (const want of WANTED) {
  const matches = sellable.filter(
    (v) =>
      Number(v.attributes.price) === want.cents &&
      v.attributes.interval === want.interval &&
      Number(v.attributes.interval_count ?? 1) === 1,
  );

  if (matches.length === 1) {
    const [only] = matches;
    resolved.push({ ...want, id: only.id, name: only.attributes.name });
    console.log(`  ok    ${want.label.padEnd(16)} -> ${only.id}  ${only.attributes.name}`);
    continue;
  }

  missing.push(want);
  console.log(
    matches.length === 0
      ? `  MISS  ${want.label.padEnd(16)} -> no variant at ${euros(want.cents)} per ${want.interval}`
      : `  AMBIG ${want.label.padEnd(16)} -> ${matches.length} variants at ${euros(
          want.cents,
        )} per ${want.interval}: ${matches.map((m) => m.id).join(", ")}`,
  );
}

if (missing.length > 0) {
  console.log(
    "\nCreate these in the dashboard (test mode must match the API key you are using).\n" +
      "Products and variants cannot be created through the API — this is the one manual step:\n",
  );
  for (const want of missing) {
    console.log(`  ${want.label}: subscription, ${euros(want.cents)}, every 1 ${want.interval}`);
  }
  console.log("\nThen run this again. Nothing was written.");
  process.exit(1);
}

/* ---------------------------------------------------------------- *
 * Everything below only runs once all four variants resolved.
 * ---------------------------------------------------------------- */

/*
 * `--verify`: what `.env` holds, against what the store says.
 *
 * Deliberately placed here — after the variants have resolved, before
 * `readEnvFile()`. This mode reads no file, writes no file, generates no secret
 * and does not touch the webhook, and keeping it above every one of those calls
 * is what makes that true by construction rather than by a flag checked in five
 * places.
 *
 * It matters most on the day the store is configured a **second** time, in live
 * mode, against a different key and a different set of products — the run where
 * a wrong id charges a real card the wrong price, and the run done in a hurry.
 */
if (verify) {
  const problems = [];

  const check = (label, name, expected) => {
    const value = (process.env[name] ?? "").trim();

    if (!value) {
      problems.push(name);
      console.log(`  UNSET ${label.padEnd(16)} store says ${expected}  (${name})`);
    } else if (value !== expected) {
      problems.push(name);
      console.log(
        `  WRONG ${label.padEnd(16)} .env=${value}  store=${expected}  (${name})`,
      );
    } else {
      console.log(`  ok    ${label.padEnd(16)} ${value}`);
    }
  };

  console.log();
  console.log(".env against the store:");
  console.log();

  check("Store", "LEMON_STORE_ID", store.id);
  for (const entry of resolved) check(entry.label, entry.env, entry.id);

  /*
   * Not a variant, but the same class of failure and the same cost of missing
   * it: unset, the webhook refuses every delivery it is sent, and that presents
   * as a broken endpoint rather than as a missing variable.
   */
  if (!(process.env.LEMON_WEBHOOK_SECRET ?? "").trim()) {
    problems.push("LEMON_WEBHOOK_SECRET");
    console.log(
      `  UNSET ${"Webhook secret".padEnd(16)} the webhook would refuse every delivery  (LEMON_WEBHOOK_SECRET)`,
    );
  }

  if (problems.length === 0) {
    console.log();
    console.log("All correct. Nothing was written.");
    process.exit(0);
  }

  console.log();
  console.log(
    `.env disagrees with the store on ${problems.length} ${
      problems.length === 1 ? "value" : "values"
    }.`,
  );
  console.log("Run without --verify to correct it. Nothing was written.");
  process.exit(1);
}

let env = readEnvFile();

env = setEnvVar(env, "LEMON_STORE_ID", store.id);
for (const entry of resolved) env = setEnvVar(env, entry.env, entry.id);

/*
 * A secret is generated only when there is none. Rotating it silently would
 * leave the stored value and the provider's value disagreeing for as long as it
 * took somebody to notice, and the symptom is every webhook 401ing — which reads
 * as the endpoint being broken rather than as this script having been re-run.
 */
const existingSecret = /^[ \t]*LEMON_WEBHOOK_SECRET[ \t]*=(.*)$/m.exec(env)?.[1]?.trim();
const secret = existingSecret || randomBytes(16).toString("hex");

if (!existingSecret) {
  env = setEnvVar(env, "LEMON_WEBHOOK_SECRET", secret);
  console.log("\nGenerated a new LEMON_WEBHOOK_SECRET.");
}

const appUrl = (process.env.APP_URL || "").replace(/\/+$/, "");
const webhookUrl = appUrl ? `${appUrl}/api/webhooks/billing` : null;

if (dryRun) {
  console.log("\n--dry-run: nothing written. Would set:");
  console.log(`  LEMON_STORE_ID=${store.id}`);
  for (const entry of resolved) console.log(`  ${entry.env}=${entry.id}`);
  console.log(`  webhook -> ${webhookUrl ?? "(APP_URL unset)"}`);
  process.exit(0);
}

writeFileSync(".env", env, "utf8");
console.log("\nWrote .env:");
console.log(`  LEMON_STORE_ID=${store.id}`);
for (const entry of resolved) console.log(`  ${entry.env}=${entry.id}`);

if (!webhookUrl) {
  console.log("\nAPP_URL is unset, so the webhook was left alone.");
  process.exit(0);
}

if (webhookUrl.startsWith("http://localhost")) {
  console.log(
    `\nAPP_URL is ${appUrl}, which Lemon Squeezy cannot reach, so the webhook was left alone.\n` +
      "  Point APP_URL at a public origin (or a tunnel) and run this again.",
  );
  process.exit(0);
}

const { data: webhooks } = await call("/webhooks");
const mine = webhooks.find(
  (w) => w.attributes.url === webhookUrl || !w.attributes.url,
);

const attributes = { url: webhookUrl, events: EVENTS, secret };

if (mine) {
  await call(`/webhooks/${mine.id}`, {
    method: "PATCH",
    body: { data: { type: "webhooks", id: mine.id, attributes } },
  });
  console.log(`\nWebhook ${mine.id} updated -> ${webhookUrl}`);
} else {
  const created = await call("/webhooks", {
    method: "POST",
    body: {
      data: {
        type: "webhooks",
        attributes,
        relationships: { store: { data: { type: "stores", id: store.id } } },
      },
    },
  });
  console.log(`\nWebhook ${created.data.id} created -> ${webhookUrl}`);
}

console.log(`  ${EVENTS.length} events subscribed.`);
