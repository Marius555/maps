"use client";

import { Button, toast } from "@heroui/react";
import { useId } from "react";

import {
  useEmailUnverified,
  VerifyEmailNotice,
} from "@/components/verify-email/verify-email-notice";
import { track } from "@/lib/posthog/client";
import { useCan } from "@/components/team/role-context";
import { ViewOnlyNotice } from "@/components/team/view-only-notice";
import { usePublishMap } from "@/lib/query/publish";
import { toastProblem } from "@/lib/query/toast-error";
import { isEmailUnverified } from "@/lib/query/verify-email-toast";
import type { PublishResult } from "@/lib/repositories/publish.repository";

/**
 * The button and its outcome, both as toasts. Success says Published — the action
 * keeps its name the whole way through (CLAUDE.md §8). A refusal says Couldn't
 * publish with the server's own sentence: it is about something that just
 * happened, and an alert in the sidebar pushed the design controls down when it
 * appeared and stayed after it no longer applied (`toastProblem`'s rule).
 *
 * An unconfirmed address is the one thing that disables the button, and only
 * **once `useMe` has answered** — never while it is loading. The server owns the
 * decision either way (`withAuth` refuses every write), so the cost of guessing
 * wrong here is asymmetric: a moment of an enabled button that fails honestly is
 * nothing, a verified customer staring at a permanently dead Publish is a support
 * ticket. That note stays beside the button, because it explains a disabled
 * control and a toast would expire.
 *
 * Press Publish in the instant before `useMe` answers and the 403 arrives with a
 * toast already raised for it globally (`lib/query/client.ts`), so the `catch`
 * skips that one error rather than say it twice.
 */
export function PublishAction({ mapId }: { mapId: string }) {
  const publish = usePublishMap(mapId);
  const unverified = useEmailUnverified();
  const noteId = useId();
  // A team viewer reaches this page for the snippet, not to publish.
  const canPublish = useCan("edit");

  const onPress = async () => {
    try {
      const result = await publish.mutateAsync();
      track("map_published", {
        published_location_count: result.publishedCount,
        skipped_location_count: result.skippedCount,
      });
      toast.success("Published", { description: describe(result) });
    } catch (error) {
      if (!isEmailUnverified(error)) toastProblem("Couldn’t publish", error);
    }
  };

  if (!canPublish) return <ViewOnlyNotice />;

  return (
    <div className="space-y-3">
      <Button
        className="w-full"
        onPress={onPress}
        isPending={publish.isPending}
        isDisabled={unverified}
        aria-describedby={unverified ? noteId : undefined}
      >
        Publish
      </Button>

      {/* Terms §10.4: publishing confirms the owner checked what the map
          shows, so it is said beside the button that does it. */}
      <p className="text-xs text-muted text-pretty">
        Check every location before you publish — you’re responsible for where
        each pin sits.
      </p>

      <VerifyEmailNotice id={noteId} />
    </div>
  );
}

function describe({
  publishedCount,
  skippedCount,
  skippedNames,
}: PublishResult): string {
  const live = `${publishedCount} ${
    publishedCount === 1 ? "location is" : "locations are"
  } live.`;

  if (skippedCount === 0) return live;

  // Named rather than counted where possible — "3 were left out" sends someone
  // hunting through a list of 300.
  const named = skippedNames.join(", ");
  const rest = skippedCount - skippedNames.length;
  const which = rest > 0 ? `${named} and ${rest} more` : named;

  return `${live} Left out ${which} — no usable position.`;
}
