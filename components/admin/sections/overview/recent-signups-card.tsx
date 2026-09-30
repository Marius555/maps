import { Avatar, Chip } from "@heroui/react";

import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { LinkButton } from "@/components/ui/link-button";
import { formatDateTime } from "@/lib/admin/format";
import type { OverviewMetrics } from "@/lib/admin/metrics/overview";
import { api } from "@/lib/admin/source";
import { initialsOf } from "@/lib/format/initials";
import { SourceBadge } from "../../kpi/source-badge";

/** The newest accounts, with whether they have confirmed their address. Not drawn before anyone signs up. */
export function RecentSignupsCard({ users }: { users: OverviewMetrics["recentSignups"] }) {
  if (users.length === 0) return null;

  return (
    <SectionCard
      title="Latest signups"
      action={
        <div className="flex items-center gap-2">
          <SourceBadge source={api("Appwrite user records, newest first.")} />
          <LinkButton href="/admin/users" variant="ghost" size="sm">
            All users
          </LinkButton>
        </div>
      }
    >
      <ul className="divide-y divide-border">
        {users.map((user) => (
          <li key={user.id} className="flex items-center gap-3 py-2.5">
            <Avatar size="sm">
              <Avatar.Fallback>{initialsOf(user.name, user.email)}</Avatar.Fallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {user.name || user.email}
              </p>
              <p className="truncate text-xs text-muted">
                {user.name ? `${user.email} · ` : ""}
                {formatDateTime(user.createdAt)}
              </p>
            </div>
            <Chip size="sm" variant="soft" color={user.verified ? "success" : "warning"}>
              {user.verified ? "Confirmed" : "Unconfirmed"}
            </Chip>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
