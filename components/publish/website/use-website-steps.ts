"use client";

import { useCan } from "@/components/team/role-context";
import { websiteSteps } from "@/lib/publish/website-step";
import { embedAdded } from "../stepper/marked-flag";

/**
 * Where the "Your website" stepper stands (`websiteSteps`), and the one thing
 * it records: that the snippet has gone onto the owner's site, as far as this
 * browser knows (`marked-flag.ts`).
 */
export function useWebsiteSteps(
  mapId: string,
  { published, hasPendingChanges }: { published: boolean; hasPendingChanges: boolean },
) {
  const canPublish = useCan("edit");
  const isEmbedAdded = embedAdded.useMarked(mapId);

  return {
    ...websiteSteps({ published, hasPendingChanges, embedAdded: isEmbedAdded, canPublish }),
    markEmbedAdded: () => embedAdded.mark(mapId),
  };
}
