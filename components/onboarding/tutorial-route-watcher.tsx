"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { TutorialId } from "@/lib/onboarding/tutorials";
import { useMarkTutorialSeen } from "@/lib/query/account";
import { Tutorial } from "./tutorial-overlay";
import { dismissTutorial, isTutorialDismissed } from "./tutorial-store";

/**
 * The overlays that follow the owner between pages rather than belonging to
 * one. Mounted once, in the dashboard shell, which stays up across navigations.
 *
 * - **Coming back from the card designer** — to whatever page, since the
 *   sidebar's Publish link is on all of them — draws "Ready to publish?".
 * - **Reaching a page an arrow points at** counts that arrow as seen, however
 *   the owner got there: the arrow's whole job was getting them to it. For the
 *   card this also keeps its overlay off the page they come back to.
 *
 * `pending` is what the layout found unseen on the last full load; this tab's
 * own closes are in the store.
 */
export function TutorialRouteWatcher({ pending }: { pending: readonly TutorialId[] }) {
  const pathname = usePathname();
  const [previous, setPrevious] = useState(pathname);
  const [returnedFromCard, setReturnedFromCard] = useState(false);

  // During render rather than in an effect: it is state derived from the
  // change of path, not a side effect of it.
  if (pathname !== previous) {
    setPrevious(pathname);
    if (inSection(previous, "card") && !inSection(pathname, "card")) {
      setReturnedFromCard(true);
    }
  }

  const markCardSeen = useMarkTutorialSeen("card").mutate;
  const markPublishSeen = useMarkTutorialSeen("publish").mutate;

  useEffect(() => {
    const reached = (id: TutorialId, section: string) =>
      inSection(pathname, section) && pending.includes(id) && !isTutorialDismissed(id);

    if (reached("card", "card")) {
      dismissTutorial("card");
      markCardSeen();
    }
    if (reached("publish", "publish")) {
      dismissTutorial("publish");
      markPublishSeen();
    }
  }, [pathname, pending, markCardSeen, markPublishSeen]);

  // Not on Publish itself: the effect above is about to count it as found, and
  // the overlay would flash for a frame first.
  const showPublish =
    returnedFromCard && pending.includes("publish") && !inSection(pathname, "publish");

  return showPublish ? <Tutorial id="publish" /> : null;
}

/** Whether `pathname` is inside a map's `section` page, e.g. `/maps/x/card`. */
function inSection(pathname: string, section: string): boolean {
  return new RegExp(`^/maps/[^/]+/${section}(/|$)`).test(pathname);
}
