import { created, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { createGroup, listGroups } from "@/lib/repositories/groups.repository";
import { paginationSchema } from "@/lib/validation/common";
import { createGroupSchema } from "@/lib/validation/group.schema";

type Params = { id: string };

export const GET = withAuth<Params>(async ({ request, params, ctx }) => {
  const search = request.nextUrl.searchParams;
  const { cursor, limit } = paginationSchema.parse({
    cursor: search.get("cursor"),
    limit: search.get("limit") ?? undefined,
  });

  const page = await listGroups(ctx, params.id, { cursor, limit });

  return ok({
    groups: page.items,
    nextCursor: page.nextCursor,
    total: page.total,
  });
});

export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, createGroupSchema);
  return created({ group: await createGroup(ctx, params.id, input) });
});
