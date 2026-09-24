import "server-only";

import { deleteUser } from "@/lib/auth/account";
import {
  deleteAccountRows,
  deleteEmptiedMap,
  deleteFiles,
  deletePlaces,
  listOwnedMapIds,
  takePlaceFiles,
} from "@/lib/repositories/account-deletion.repository";
import type { RepoContext } from "@/lib/repositories/context";
import type { DeletionStore } from "./step";

/** The real store behind `runDeletionStep`, scoped to one account. */
export function deletionStoreFor(ctx: RepoContext): DeletionStore {
  return {
    listMapIds: () => listOwnedMapIds(ctx),
    takePlaceFiles: (mapId) => takePlaceFiles(ctx, mapId),
    deleteFiles,
    deletePlaces: (mapId, placeIds) => deletePlaces(ctx, mapId, placeIds),
    deleteEmptiedMap: (mapId) => deleteEmptiedMap(ctx, mapId),
    deleteAccountRows: () => deleteAccountRows(ctx),
    deleteUser: () => deleteUser(ctx.userId),
  };
}
