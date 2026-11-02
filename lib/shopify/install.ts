import "server-only";

import { createShopAccount, deleteUser } from "@/lib/auth/account";
import { forgetUser } from "@/lib/auth/identity-cache";
import {
  createShop,
  findShop,
  ShopAlreadyInstalledError,
  updateShop,
  type ShopifyShop,
} from "@/lib/repositories/shopify-shops.repository";
import { captureServerEvent } from "@/lib/posthog/server";
import { adminSession, readShopInfo } from "./admin-api";
import { SHOPIFY_SIGNUP } from "./funnel";

/**
 * Make sure a shop that just opened the app has a workspace — creating one the
 * first time, reopening the old one after a reinstall. Called only by the App
 * Home (`app/shopify/route.ts`), with a shop taken from a verified ID token.
 *
 * **Install is here, not in a separate OAuth flow.** Scopes are declared in
 * `shopify.app.toml` and granted by Shopify before the app first loads
 * ("Shopify managed installation"), so the first load *is* the install. The
 * token exchange below is what App Store requirement 2.3.2 ("authenticate
 * immediately after install") asks for.
 *
 * Idempotent and race-safe: two tabs opening a fresh install at once each make
 * an account, the unique index on `shop` lets one row win, and the loser
 * deletes its account and returns the winner's row.
 */
export async function provisionShop(shop: string, idToken: string): Promise<ShopifyShop> {
  const existing = await findShop(shop);
  if (existing && !existing.uninstalledAt && !existing.redactAfter) return existing;

  const info = await readShopInfo(await adminSession(shop, idToken));
  const details = {
    shopGid: info.id,
    name: info.name,
    email: info.email,
    primaryDomain: info.primaryDomain,
  };

  if (existing) {
    // A reinstall inside Shopify's 48 hours: the same workspace, maps intact.
    const reopened = await updateShop(existing.id, {
      ...details,
      installedAt: new Date().toISOString(),
      uninstalledAt: null,
      redactAfter: null,
    });
    forgetUser(reopened.workspaceId);
    return reopened;
  }

  const workspaceId = await createShopAccount(info.name || shop);

  let created: ShopifyShop;
  try {
    created = await createShop({ shop, workspaceId, ...details });
  } catch (error) {
    await deleteUser(workspaceId).catch(() => {});

    if (error instanceof ShopAlreadyInstalledError) {
      const winner = await findShop(shop);
      if (winner) return winner;
    }

    throw error;
  }

  // The funnel's first step, which a web sign-up sends from its form. Only for
  // a shop created here — not a reinstall, not the losing tab of a race.
  await captureServerEvent(workspaceId, "user_signed_up", SHOPIFY_SIGNUP);
  return created;
}
