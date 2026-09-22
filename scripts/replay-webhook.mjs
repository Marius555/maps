import { createHmac } from "node:crypto";

import { Client, Users } from "node-appwrite";

/**
 * Send a correctly-signed billing webhook at a running server.
 *
 * `npm run billing:replay -- <event> [options]`
 *
 * ## Why this exists
 *
 * **Ten of the eleven events cannot be produced on demand.** A test purchase
 * fires `subscription_created` and nothing else; there is no button anywhere
 * that makes Lemon Squeezy emit `subscription_expired`, `past_due` or a failed
 * renewal, and waiting a month for one is not a test. So the only way to find
 * out what this app does when a subscription lapses is to say so ourselves, in
 * the provider's own shape, signed with the provider's own secret.
 *
 * It is also the only test of the activation half that needs no public URL. A
 * real webhook has to reach us from the internet, which means a deployment or a
 * tunnel; this reaches `localhost` directly.
 *
 * ## What it does not prove
 *
 * That Lemon Squeezy's *own* POST verifies against our secret. This script signs
 * the way `verifyWebhook` checks, so the two agree by construction and would
 * keep agreeing if both were wrong together. One real test purchase over a
 * tunnel is what proves that, and it only has to be done once — see
 * `docs/notes/billing.md`.
 *
 * ## The one event class that needs a real subscription
 *
 * `subscription_payment_*` carries an **invoice**, which has no plan on it, so
 * the route answers it by asking the API what the subscription says
 * (`fetchSubscriptionState`). That call goes to the real provider. With an
 * invented id it 404s and the route answers 5xx — correct behaviour, confusing
 * output. Pass `--subscription <id>` with a real one from a test purchase, which
 * the account page's portal link or the Lemon Squeezy dashboard will give you.
 */

const EVENTS = {
  subscription_created: { kind: "subscription", status: "active" },
  subscription_updated: { kind: "subscription", status: "active" },
  subscription_cancelled: { kind: "subscription", status: "cancelled" },
  subscription_expired: { kind: "subscription", status: "expired" },
  subscription_resumed: { kind: "subscription", status: "active" },
  subscription_paused: { kind: "subscription", status: "paused" },
  subscription_unpaused: { kind: "subscription", status: "active" },
  subscription_payment_success: { kind: "invoice", status: "paid" },
  subscription_payment_failed: { kind: "invoice", status: "failed" },
  subscription_payment_recovered: { kind: "invoice", status: "paid" },
  subscription_payment_refunded: { kind: "invoice", status: "refunded" },
};

function flag(name, fallback = null) {
  const at = process.argv.indexOf(`--${name}`);

  return at === -1 ? fallback : (process.argv[at + 1] ?? fallback);
}

const event = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!event || !(event in EVENTS)) {
  console.error(
    `Usage: npm run billing:replay -- <event> [options]\n\n` +
      `Events:\n${Object.keys(EVENTS)
        .map((name) => `  ${name}`)
        .join("\n")}\n\n` +
      `Options:\n` +
      `  --email <address>     the account to grant it to, looked up in Appwrite\n` +
      `  --user <id>           the same thing, if you already know the id\n` +
      `  --plan starter|pro    default starter\n` +
      `  --cadence monthly|yearly   default monthly\n` +
      `  --subscription <id>   required for subscription_payment_* (see the docblock)\n` +
      `  --url <origin>        default http://localhost:3000\n` +
      `  --dry-run             print the payload and signature, send nothing`,
  );
  process.exit(1);
}

const secret = process.env.LEMON_WEBHOOK_SECRET;

if (!secret) {
  console.error("LEMON_WEBHOOK_SECRET is not set, so the endpoint would refuse this.");
  process.exit(1);
}

const plan = flag("plan", "starter");
const cadence = flag("cadence", "monthly");

if (!["starter", "pro"].includes(plan) || !["monthly", "yearly"].includes(cadence)) {
  console.error(`Unknown plan or cadence: ${plan} / ${cadence}`);
  process.exit(1);
}

/*
 * The same variable the app reads, deliberately. A wrong id in `.env` makes this
 * replay fail exactly the way production would — `offerForVariant` matches
 * nothing and the route declines the event — which is worth far more than a
 * replay that always works.
 */
const variantEnv = `LEMON_VARIANT_${plan.toUpperCase()}_${cadence.toUpperCase()}`;
const variantId = process.env[variantEnv];

if (!variantId) {
  console.error(`${variantEnv} is not set. Run \`npm run setup:lemon\` first.`);
  process.exit(1);
}

/**
 * The account to grant this to.
 *
 * `--email` is here because nothing in the product ever shows a user id — the
 * account page shows an address — so without it the first step of every test is
 * digging through the Appwrite console.
 */
const userId = await (async () => {
  const direct = flag("user");
  if (direct) return direct;

  const email = flag("email");

  if (!email) {
    console.error("Pass --email <address> or --user <id>.");
    process.exit(1);
  }

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY;

  if (!endpoint || !project || !key) {
    console.error("Appwrite is not configured, so --email cannot be resolved.");
    process.exit(1);
  }

  const users = new Users(
    new Client().setEndpoint(endpoint).setProject(project).setKey(key),
  );

  const found = await users.list({ queries: [] });
  const match = found.users.find(
    (user) => user.email.toLowerCase() === email.toLowerCase(),
  );

  if (!match) {
    console.error(`No account with the address ${email}.`);
    process.exit(1);
  }

  return match.$id;
})();

const shape = EVENTS[event];
const subscriptionId = flag("subscription", "replay-subscription");

/** A month or a year out, so `currentPeriodEnd` is a date the app would accept. */
const renewsAt = (() => {
  const date = new Date();

  if (cadence === "yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);

  return date.toISOString();
})();

/*
 * `ends_at` for a subscription winding down, `renews_at` for one running — never
 * both, because the route prefers `ends_at` and reading a renewal date off a
 * cancelled subscription would extend a plan somebody stopped paying for.
 */
const winding = shape.status === "cancelled" || shape.status === "expired";

const body =
  shape.kind === "subscription"
    ? {
        meta: { event_name: event, custom_data: { user_id: userId } },
        data: {
          id: subscriptionId,
          type: "subscriptions",
          attributes: {
            status: shape.status,
            customer_id: 42,
            variant_id: Number(variantId),
            renews_at: winding ? null : renewsAt,
            ends_at: winding ? renewsAt : null,
          },
        },
      }
    : {
        meta: { event_name: event, custom_data: { user_id: userId } },
        data: {
          id: "replay-invoice",
          type: "subscription-invoices",
          attributes: {
            store_id: Number(process.env.LEMON_STORE_ID ?? 0),
            subscription_id: subscriptionId,
            customer_id: 42,
            status: shape.status,
            // Note what is absent: no variant_id, and no subscription status.
          },
        },
      };

/*
 * Signed over the **exact bytes** that are sent. Serialising twice would produce
 * a different string for the same document — key order, number formatting,
 * whitespace — and the digest would not match. Same reason the route reads
 * `request.text()` and parses afterwards.
 */
const raw = JSON.stringify(body);
const signature = createHmac("sha256", secret).update(raw).digest("hex");

const origin = (flag("url", "http://localhost:3000") ?? "").replace(/\/+$/, "");
const target = `${origin}/api/webhooks/billing`;

console.log(`${event}  ->  ${target}`);
console.log(`  account   ${userId}`);
console.log(
  shape.kind === "subscription"
    ? `  plan      ${plan} ${cadence}, variant ${variantId}, status ${shape.status}`
    : `  invoice   status ${shape.status}, subscription ${subscriptionId}`,
);

if (shape.kind === "invoice" && subscriptionId === "replay-subscription") {
  console.warn(
    "\n  ! No --subscription given. The route will ask the real API about\n" +
      "    'replay-subscription', get a 404 and answer 5xx. Pass a real\n" +
      "    subscription id from a test purchase to exercise this properly.",
  );
}

if (dryRun) {
  console.log(`\n--dry-run, nothing sent.\n\nX-Signature: ${signature}\n${raw}`);
  process.exit(0);
}

const response = await fetch(target, {
  method: "POST",
  headers: { "content-type": "application/json", "x-signature": signature },
  body: raw,
});

const text = await response.text();

console.log(`\n${response.status} ${response.statusText}  ${text}`);

/*
 * `handled: false` is a 200 and therefore not an HTTP failure, but it is always a
 * failure of the replay: it means the event was understood and no row was
 * written. Exiting non-zero on it is what makes this usable from a script.
 */
if (!response.ok || text.includes('"handled":false')) {
  if (!response.ok) {
    console.error("\nThe route rejected it. The dev server's log has the reason.");
  } else if (shape.kind === "invoice") {
    console.error(
      "\nThe route declined it, which for a payment event means the provider\n" +
        `had no subscription ${subscriptionId}, or its variant matches no plan.\n` +
        "Pass --subscription with a real id from a test purchase.",
    );
  } else {
    console.error(
      "\nThe route declined it. Most likely the variant id matches no plan\n" +
        "(check LEMON_VARIANT_*), or the account could not be found.",
    );
  }

  process.exit(1);
}

console.log("\nWritten. Reload /account to see it.");
