import { ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";

export const GET = withAuth(async ({ user }) => ok({ user }));
