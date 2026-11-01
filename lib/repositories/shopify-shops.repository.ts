import "server-only";

import { ID, Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isConflict, toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import { asWorkspaceId, type WorkspaceId } from "./context";

/**
 * The shops that installed the Shopify app, one row each (docs/notes/shopify.md).
 *
 * Keyed by the shop's `*.myshopify.com` domain, which is what every ID token
 * and every webhook names. **No `RepoContext`**: a shop row is looked up to
 * *find* the workspace, before there is a context to hold, the same way
 * `findUserByBillingCustomer` works for a billing webhook. Callers pass a shop
 * that came out of a verified ID token or a verified webhook — never one from
 * a query string.
 *
 * Admin client only; the table carries no permissions.
 */

type ShopRow = Models.Row & {
  shop: string;
  shopGid?: string | null;
  workspaceId: string;
  name?: string | null;
  email?: string | null;
  primaryDomain?: string | null;
  installedAt: string;
  uninstalledAt?: string | null;
  planCheckedAt?: string | null;
  redactAfter?: string | null;
};

export type ShopifyShop = {
  id: string;
  /** `demo-shop.myshopify.com` */
  shop: string;
  /** `gid://shopify/Shop/<n>`, what the Partner API names the shop by. Empty only on a row written before install read it. */
  shopGid: string;
  workspaceId: WorkspaceId;
  name: string;
  email: string;
  /** The storefront's public host — a custom domain, or the shop domain. */
  primaryDomain: string;
  installedAt: string;
  /** Set while the app is uninstalled; a reinstall clears it. */
  uninstalledAt: string | null;
  planCheckedAt: string | null;
  redactAfter: string | null;
};

export type NewShopifyShop = {
  shop: string;
  shopGid: string;
  workspaceId: string;
  name: string;
  email: string;
  primaryDomain: string;
};

export type ShopifyShopPatch = Partial<
  Pick<
    ShopifyShop,
    "shopGid" | "name" | "email" | "primaryDomain" | "installedAt" | "uninstalledAt" | "planCheckedAt" | "redactAfter"
  >
>;

/** Thrown when two first loads raced to create the same shop; the loser re-reads. */
export class ShopAlreadyInstalledError extends Error {
  constructor() {
    super("This shop already has a row.");
    this.name = "ShopAlreadyInstalledError";
  }
}

function toShop(row: ShopRow): ShopifyShop {
  return {
    id: row.$id,
    shop: row.shop,
    shopGid: row.shopGid ?? "",
    workspaceId: asWorkspaceId(row.workspaceId),
    name: row.name ?? "",
    email: row.email ?? "",
    primaryDomain: row.primaryDomain || row.shop,
    installedAt: row.installedAt,
    uninstalledAt: row.uninstalledAt ?? null,
    planCheckedAt: row.planCheckedAt ?? null,
    redactAfter: row.redactAfter ?? null,
  };
}

async function findOne(queries: string[]): Promise<ShopifyShop | null> {
  try {
    const result = await admin.tablesDB.listRows<ShopRow>({
      databaseId: env.databaseId,
      tableId: TABLES.shopifyShops,
      queries: [...queries, Query.limit(1)],
    });

    const row = result.rows[0];
    return row ? toShop(row) : null;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function findShop(shop: string): Promise<ShopifyShop | null> {
  return findOne([Query.equal("shop", shop)]);
}

/** The shop a workspace is, or null for every workspace that is not one. */
export async function findShopByWorkspace(workspaceId: WorkspaceId): Promise<ShopifyShop | null> {
  return findOne([Query.equal("workspaceId", workspaceId)]);
}

/**
 * Record a newly installed shop. The unique index on `shop` decides a race
 * between two first loads: the loser gets `ShopAlreadyInstalledError` and
 * re-reads the winner's row.
 */
export async function createShop(input: NewShopifyShop): Promise<ShopifyShop> {
  try {
    const row = await admin.tablesDB.createRow<ShopRow>({
      databaseId: env.databaseId,
      tableId: TABLES.shopifyShops,
      rowId: ID.unique(),
      data: { ...input, installedAt: new Date().toISOString() },
      permissions: [],
    });

    return toShop(row);
  } catch (error) {
    if (isConflict(error)) throw new ShopAlreadyInstalledError();
    throw toRepositoryError(error);
  }
}

export async function updateShop(id: string, patch: ShopifyShopPatch): Promise<ShopifyShop> {
  try {
    const row = await admin.tablesDB.updateRow<ShopRow>({
      databaseId: env.databaseId,
      tableId: TABLES.shopifyShops,
      rowId: id,
      data: patch,
    });

    return toShop(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** Shops whose redaction date has passed, oldest first — the hourly sweep's queue. */
export async function listShopsDueForRedaction(now: Date, limit = 10): Promise<ShopifyShop[]> {
  try {
    const result = await admin.tablesDB.listRows<ShopRow>({
      databaseId: env.databaseId,
      tableId: TABLES.shopifyShops,
      queries: [
        Query.isNotNull("redactAfter"),
        Query.lessThanEqual("redactAfter", now.toISOString()),
        Query.orderAsc("redactAfter"),
        Query.limit(limit),
      ],
    });

    return result.rows.map(toShop);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function deleteShop(id: string): Promise<void> {
  try {
    await admin.tablesDB.deleteRow({
      databaseId: env.databaseId,
      tableId: TABLES.shopifyShops,
      rowId: id,
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}
