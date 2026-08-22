import { ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { deleteGroupContents } from "@/lib/repositories/groups.repository";

type Params = { id: string; groupId: string };

/*
 * Deletes the group and every location and shape inside it.
 *
 * Its own route rather than a flag on the group's own DELETE, for the reason the
 * pin route gives: the two are different actions on different rows, and putting
 * them behind one endpoint separated by a query parameter would make the
 * destructive one reachable by getting a boolean wrong.
 *
 * `/contents` names what goes, and the plain DELETE one level up stays what it
 * has always been — take the bundle apart, keep everything in it.
 *
 * Answers with the counts so the client can say what it removed rather than
 * guessing from whatever it happened to have cached.
 */
export const DELETE = withAuth<Params>(async ({ params, ctx }) => {
  const counts = await deleteGroupContents(ctx, params.id, params.groupId);

  return ok(counts);
});
