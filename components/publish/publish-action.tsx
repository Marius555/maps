"use client";

import { Button, toast } from "@heroui/react";

import { ErrorMessage } from "@/components/ui/error-message";
import { usePublishMap } from "@/lib/query/publish";
import type { PublishResult } from "@/lib/repositories/publish.repository";

/**
 * The button and its failure state together, because they are one mutation.
 * Splitting them would mean two `usePublishMap()` calls and therefore two
 * independent mutation states — the button would run while the error stayed
 * empty forever.
 *
 * The action keeps its name the whole way through: the button says Publish and
 * the toast says Published (CLAUDE.md §8). That toast is the only animation
 * here — feedback, not decoration, and HeroUI's CSS handles reduced motion.
 */
export function PublishAction({ mapId }: { mapId: string }) {
  const publish = usePublishMap(mapId);

  const onPress = async () => {
    try {
      const result = await publish.mutateAsync();
      toast.success("Published", { description: describe(result) });
    } catch {
      // Rendered below. A toast as well would say the same thing twice.
    }
  };

  return (
    <div className="space-y-3">
      {publish.error ? <ErrorMessage error={publish.error} /> : null}

      <Button onPress={onPress} isPending={publish.isPending}>
        Publish
      </Button>
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
