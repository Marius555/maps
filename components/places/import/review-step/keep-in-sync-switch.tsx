"use client";

import { Description, Switch } from "@heroui/react";

import { useImportStore } from "@/lib/stores/import-store";

/**
 * Keep the map in sync with the Google Sheet it is being imported from.
 *
 * On by default, because a sheet someone pastes a link to is usually a sheet
 * they keep editing — that is the whole difference between it and a file.
 *
 * Only drawn for a Google Sheet. On a plan without sheet sync it is still drawn,
 * off and disabled, with the plan named: a feature nobody can see is a feature
 * nobody upgrades for, and hiding it would also hide why the map will not
 * follow the sheet.
 *
 * The hint says the one thing linking changes about *this* screen: the sheet is
 * in charge from now on, so an edit or a skipped row here lasts only until the
 * first sync.
 */
export function KeepInSyncSwitch({ isAllowed }: { isAllowed: boolean }) {
  const sourceKind = useImportStore((state) => state.sourceKind);
  const hasSheet = useImportStore((state) => state.sheetReference !== null);
  const keepInSync = useImportStore((state) => state.keepInSync);
  const setKeepInSync = useImportStore((state) => state.setKeepInSync);

  if (sourceKind !== "google-sheet" || !hasSheet) return null;

  return (
    <Switch
      isDisabled={!isAllowed}
      isSelected={isAllowed && keepInSync}
      onChange={setKeepInSync}
    >
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <span className="text-sm">Keep in sync with the sheet</span>
      </Switch.Content>
      <Description className="text-pretty">
        {isAllowed
          ? "Updated daily, or whenever you press Sync now. The sheet stays in charge: rows you edit or skip here come back as the sheet has them."
          : "Syncing with a sheet is included on the Starter and Pro plans."}
      </Description>
    </Switch>
  );
}
