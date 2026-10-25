import { NotificationsSkeleton } from "@/components/notifications/drawer/notifications-skeleton";
import { Container, Measure } from "@/components/ui/container";

/** Shown while the notifications load: three rows in the list's own frame. */
export default function NotificationsLoading() {
  return (
    <Container>
      <Measure>
        <NotificationsSkeleton />
      </Measure>
    </Container>
  );
}
