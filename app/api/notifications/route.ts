import { ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { loadNotificationFeed } from "@/lib/notifications/feed";

/** The account's notifications and how many are new — the sidebar's count. */
export const GET = withAuth(async ({ user }) => ok(await loadNotificationFeed(user.id)));
