import { Bell } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";

/** Nothing sent to this account yet — or nothing that has not expired. */
export function NotificationsEmpty() {
  return (
    <EmptyState
      icon={Bell}
      title="You're all caught up"
      description="Product news, planned maintenance and messages about your account show up here."
      action={
        <LinkButton href="/maps" variant="secondary" size="sm">
          Back to your maps
        </LinkButton>
      }
    />
  );
}
