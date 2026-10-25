import { Bell } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";

/**
 * Nothing sent to this account yet — or nothing that has not expired.
 *
 * The page links back to the maps; the drawer does not, because closing it
 * already is the way back to whatever was underneath.
 */
export function NotificationsEmpty({ showBackLink = true }: { showBackLink?: boolean }) {
  return (
    <EmptyState
      icon={Bell}
      title="You're all caught up"
      description="Product news, planned maintenance and messages about your account show up here."
      action={
        showBackLink ? (
          <LinkButton href="/maps" variant="secondary" size="sm">
            Back to your maps
          </LinkButton>
        ) : undefined
      }
    />
  );
}
