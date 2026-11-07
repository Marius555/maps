"use client";

import { Button, toast } from "@heroui/react";
import { useId, useState } from "react";

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
import { useSettleDesign } from "./design-sidebar/design-writes-context";
import { TextAction } from "./stepper/text-action";

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
 *
 * It lives in the Publish footer's steppers — "Your store" inside the Shopify
 * admin, "Your website" everywhere else — and wherever it is drawn as a button
 * it is the step's one filled button, at the stepper's small size, full width.
 * `onStorefront` says in the toast where the update lands, and `redeploy`
 * names it Redeploy — drawn only when the map has changes to send, so it
 * always re-sends something already live. The toast follows the name.
 *
 * **A press first waits for the designer's last save** (`useSettleDesign`):
 * the snapshot is built from the settings as stored, and a Redeploy pressed
 * within 400ms of a switch used to publish the value from before it.
 *
 * `look="text"` is the same press drawn as words (`TextAction`), for the one
 * place Redeploy must be reachable without competing with the filled button:
 * a Shopify map off the storefront with edits. A viewer gets nothing there,
 * since the notice beside a button would be the whole step.
 */
export function PublishAction({
  mapId,
  onStorefront = false,
  redeploy = false,
  look = "button",
}: {
  mapId: string;
  /** The map is on its Shopify shop's storefront list. */
  onStorefront?: boolean;
  /** "Redeploy" / "Redeployed" in place of "Publish" / "Published". */
  redeploy?: boolean;
  look?: "button" | "text";
}) {
  const publish = usePublishMap(mapId);
  const settleDesign = useSettleDesign();
  // Pending covers the wait for the designer's last save as well as the
  // publish itself — one press, one spinner.
  const [isSettling, setIsSettling] = useState(false);
  const isPending = isSettling || publish.isPending;
  const unverified = useEmailUnverified();
  const noteId = useId();
  // A team viewer reaches this page for the snippet, not to publish.
  const canPublish = useCan("edit");

  const onPress = async () => {
    try {
      // The snapshot is built from the stored settings, so the last press in
      // the designer has to have landed first — see `DesignWritesProvider`.
      setIsSettling(true);
      try {
        await settleDesign();
      } finally {
        setIsSettling(false);
      }
      const result = await publish.mutateAsync();
      track("map_published", {
        published_location_count: result.publishedCount,
        skipped_location_count: result.skippedCount,
      });
      // Within a minute rather than now: the live snapshot is cached for 60
      // seconds (lib/snapshot/r2-store.ts).
      const where = onStorefront ? " Your storefront shows it within a minute." : "";
      toast.success(redeploy ? "Redeployed" : "Published", {
        description: `${describe(result)}${where}`,
      });
    } catch (error) {
      if (!isEmailUnverified(error)) {
        toastProblem(redeploy ? "Couldn’t redeploy" : "Couldn’t publish", error);
      }
    }
  };

  const label = redeploy ? "Redeploy" : "Publish";

  if (look === "text") {
    if (!canPublish) return null;
    return (
      <TextAction isDisabled={unverified || isPending} onPress={() => void onPress()}>
        {isPending ? `${label}ing…` : label}
      </TextAction>
    );
  }

  if (!canPublish) return <ViewOnlyNotice />;

  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        onPress={onPress}
        isPending={isPending}
        isDisabled={unverified}
        aria-describedby={unverified ? noteId : undefined}
      >
        {label}
      </Button>

      {/* Terms §10.4: "By publishing a map you confirm that you have checked
          what it shows" — so it is said beside the button that does it, in
          the Terms' own words rather than a longer paraphrase of them. */}
      <p className="text-xs text-muted text-pretty">
        Publishing confirms you&rsquo;ve checked every pin.
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
