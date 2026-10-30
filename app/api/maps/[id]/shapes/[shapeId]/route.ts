import { noContent, ok } from "@/lib/api/responses";
import { parseBody, withMapAuth } from "@/lib/api/route";
import {
  deleteShape,
  getShape,
  updateShape,
} from "@/lib/repositories/shapes.repository";
import { updateShapeSchema } from "@/lib/validation/shape.schema";

type Params = { id: string; shapeId: string };

export const GET = withMapAuth<Params>(async ({ params, ctx }) =>
  ok({ shape: await getShape(ctx, params.id, params.shapeId) }),
);

export const PATCH = withMapAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, updateShapeSchema);
  return ok({ shape: await updateShape(ctx, params.id, params.shapeId, input) });
});

export const DELETE = withMapAuth<Params>(async ({ params, ctx }) => {
  await deleteShape(ctx, params.id, params.shapeId);
  return noContent();
});
