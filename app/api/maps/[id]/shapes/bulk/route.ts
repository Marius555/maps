import { created } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { createShapes } from "@/lib/repositories/shapes.repository";
import { bulkCreateShapesSchema } from "@/lib/validation/shape.schema";

type Params = { id: string };

/**
 * The confirm step of a GeoJSON import. Plan limits are enforced in the
 * repository, once for the whole batch — see `createShapes` for why that matters
 * more here than it does for places.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, bulkCreateShapesSchema);
  const shapes = await createShapes(ctx, params.id, input.shapes);

  return created({ shapes, count: shapes.length });
});
