import { z } from "zod";

import { cardLayoutSchema } from "./card-layout.schema";

/**
 * What `PATCH /api/account/card-design` accepts.
 *
 * A schema of its own rather than reusing `updateMapSchema`'s `cardLayout`
 * field: the design is no longer part of a map at all (see
 * lib/repositories/card-design.repository.ts), so it gets its own endpoint and
 * its own body shape. `cardLayoutSchema` itself is unchanged — same clamping,
 * same rules, just saved somewhere else now.
 */
export const updateCardDesignSchema = z.object({
  cardLayout: cardLayoutSchema,
});

export type UpdateCardDesignInput = z.output<typeof updateCardDesignSchema>;
