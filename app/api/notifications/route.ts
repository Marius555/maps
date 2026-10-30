import { ok } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";
import { loadNotificationFeed } from "@/lib/notifications/feed";

/** The account's notifications and how many are new — the sidebar's count. */
export const GET = withPersonalAuth(async ({ user }) => ok(await loadNotificationFeed(user.id)));
