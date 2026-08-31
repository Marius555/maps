import "server-only";

import { ID, Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import type { CardLayout } from "@/packages/shared/card-layout";
import type { RepoContext } from "./context";
import { ownerPermissions } from "./maps.repository";

/**
 * The account's own card design — one row per user, found by `userId` rather
 * than a fixed row id, the same way `getUserPlan` reads `subscriptions`.
 *
 * Raw, unresolved JSON in and out, on the same argument every other JSON
 * column in this codebase makes: a repository hands back what is stored, and
 * `readCardLayout` (lib/validation/card-layout.schema.ts) is what turns that
 * into something drawable. Two different callers want two different answers
 * from "nothing saved yet" — the designer wants a blank canvas, a published
 * snapshot wants the populated default it has always shown — and only the raw
 * value lets each decide for itself.
 */

type CardDesignRow = Models.Row & {
  userId: string;
  cardLayout?: string | null;
};

async function findRow(userId: string): Promise<CardDesignRow | null> {
  const result = await admin.tablesDB.listRows<CardDesignRow>({
    databaseId: env.databaseId,
    tableId: TABLES.cardDesigns,
    queries: [Query.equal("userId", userId), Query.limit(1)],
  });

  return result.rows[0] ?? null;
}

function parseCardLayout(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** The stored blob, or `{}` for an account that has never saved one. Never throws. */
export async function getCardDesign(
  ctx: RepoContext,
): Promise<Record<string, unknown>> {
  try {
    const row = await findRow(ctx.userId);
    return parseCardLayout(row?.cardLayout);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Upsert, because there is no id to update against until the first save: an
 * account's row does not exist before it opens the designer and changes
 * something.
 */
export async function saveCardDesign(
  ctx: RepoContext,
  cardLayout: CardLayout,
): Promise<Record<string, unknown>> {
  try {
    const row = await findRow(ctx.userId);
    const data = { cardLayout: JSON.stringify(cardLayout) };

    if (row) {
      await admin.tablesDB.updateRow({
        databaseId: env.databaseId,
        tableId: TABLES.cardDesigns,
        rowId: row.$id,
        data,
      });
    } else {
      await admin.tablesDB.createRow({
        databaseId: env.databaseId,
        tableId: TABLES.cardDesigns,
        rowId: ID.unique(),
        data: { userId: ctx.userId, ...data },
        permissions: ownerPermissions(ctx.userId),
      });
    }

    return cardLayout;
  } catch (error) {
    throw toRepositoryError(error);
  }
}
