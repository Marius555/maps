import { ok } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";

export const GET = withPersonalAuth(async ({ user }) => ok({ user }));
