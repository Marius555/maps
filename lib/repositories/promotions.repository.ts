import "server-only";

import { ID, Query } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import type { PromotionRow } from "./types";

/**
 * The discount shown on /pricing for everybody — docs/notes/billing.md,
 * "Discounts". One row at most.
 *
 * Not under `repositories/admin/`, because the public pricing lookup reads it;
 * only the operator console's routes write it. The row names a discount at the
 * payment provider and nothing more: whether it is still live is asked there,
 * every time, so a promotion whose discount expired or was deleted simply stops
 * showing.
 */

export type Promotion = { discountId: string; code: string; featuredAt: string };

export async function getPromotion(): Promise<Promotion | null> {
  try {
    const result = await admin.tablesDB.listRows<PromotionRow>({
      databaseId: env.databaseId,
      tableId: TABLES.promotions,
      queries: [Query.orderDesc("featuredAt"), Query.limit(1)],
    });
    const row = result.rows[0];

    return row ? { discountId: row.discountId, code: row.code, featuredAt: row.featuredAt } : null;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Show this discount on /pricing, in place of whatever was shown. Every older
 * row is removed first and the new one gets a fresh id — never a fixed one,
 * see CLAUDE.md's "never derive or reuse an id".
 */
export async function setPromotion(discountId: string, code: string): Promise<Promotion> {
  try {
    await clearPromotion();

    const featuredAt = new Date().toISOString();

    await admin.tablesDB.createRow<PromotionRow>({
      databaseId: env.databaseId,
      tableId: TABLES.promotions,
      rowId: ID.unique(),
      data: { discountId, code, featuredAt },
      permissions: [],
    });

    return { discountId, code, featuredAt };
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** Stop showing a promotion on /pricing. With `discountId`, only if it is that one. */
export async function clearPromotion(discountId?: string): Promise<void> {
  try {
    await admin.tablesDB.deleteRows({
      databaseId: env.databaseId,
      tableId: TABLES.promotions,
      queries: discountId ? [Query.equal("discountId", discountId)] : [],
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}
