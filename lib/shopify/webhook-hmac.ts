import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Whether a webhook really came from Shopify: `X-Shopify-Hmac-Sha256` is the
 * base64 HMAC-SHA256 of the **raw** request body, keyed with the app's client
 * secret.
 *
 * Raw bytes, never a re-serialised parse — `JSON.stringify(JSON.parse(body))`
 * does not reproduce the bytes Shopify signed, which is the same trap
 * `app/api/webhooks/billing` documents for Lemon Squeezy.
 *
 * False for an unset secret, so an unconfigured deploy refuses every webhook
 * rather than accepting them unsigned.
 */
export function verifyWebhookHmac(
  rawBody: string | Buffer,
  header: string | null | undefined,
  secret: string,
): boolean {
  if (!secret || !header) return false;

  const given = Buffer.from(header.trim(), "base64");
  const expected = createHmac("sha256", secret).update(rawBody).digest();

  return given.length === expected.length && timingSafeEqual(given, expected);
}
