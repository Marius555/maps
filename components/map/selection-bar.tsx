"use client";

import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * What to do with the things the marquee just caught.
 *
 * Grouping does not happen on pointer-release. A drag that picked up one pin too
 * many would otherwise restructure the sidebar before the user could see what it
 * had selected, and undoing that means finding the group and deleting it. A bar
 * with a count and a button keeps the gesture recoverable: the selection is
 * visible on the map, and nothing is written until Group is pressed.
 *
 * Bottom-centre, in the hint bar's place — the two never show at once, because
 * the hint is about a gesture in progress and this is about one that finished.
 * Sitting them in the same spot means the answer to "what happens next" is
 * always in the same place on screen.
 */
export function SelectionBar({
  count,
  actionLabel,
  isBusy,
  extraActions,
  onGroup,
  onClear,
}: {
  /** How many objects are selected. Zero hides the bar. */
  count: number;
  /**
   * What the button says, or `null` for no button at all — see `groupAction`.
   *
   * "Merge" when the selection is several groups, "Group" when it is loose
   * objects with at most one group among them, and nothing when the selection is
   * exactly one group: clicking a group's row selects its members, and offering
   * to group a group meant pressing it built a second one and emptied the first.
   */
  actionLabel: "Group" | "Merge" | null;
  isBusy: boolean;
  /**
   * Anything else this selection can be turned into, rendered between the
   * grouping action and Clear.
   *
   * A slot rather than another pair of props, because the bar's job is to say
   * how many things are selected and give them somewhere to go — it should not
   * have to know what a tag is. Today this is the bulk tag menu; whatever comes
   * next lands here without reopening this file.
   */
  extraActions?: ReactNode;
  onGroup: () => void;
  onClear: () => void;
}) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          // Matches --duration-fast / --ease-out from globals.css.
          transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
          className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3"
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-surface py-1 pe-1 ps-3 shadow-sm">
            <span className="text-xs whitespace-nowrap text-foreground" role="status">
              {count === 1 ? "1 selected" : `${count} selected`}
            </span>

            {/* Clear stays whatever the selection is: a group selected by
                clicking its row has no action to offer, but it still has a
                highlight the user needs a way out of. */}
            {actionLabel ? (
              <Button
                size="sm"
                variant="primary"
                isPending={isBusy}
                onPress={onGroup}
              >
                {actionLabel}
              </Button>
            ) : null}

            {extraActions}

            <Button size="sm" variant="tertiary" onPress={onClear}>
              Clear
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
