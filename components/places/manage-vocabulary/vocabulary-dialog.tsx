"use client";

import { Button, Tabs, toast } from "@heroui/react";
import { Filter, ListPlus } from "lucide-react";
import { useState } from "react";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import { CustomFieldEditor } from "@/components/fields/custom-field-editor";
import { TagGroupEditor } from "@/components/tags/tag-group-editor";
import { ErrorMessage } from "@/components/ui/error-message";
import { toastError } from "@/lib/query/toast-error";
import type { AppMap, Place } from "@/lib/repositories/types";
import { useVocabularyDraft, type VocabularyTab } from "./use-vocabulary-draft";

/**
 * The map's vocabulary — its filter groups and its extra fields — in one dialog
 * on the Locations page.
 *
 * **One Save for both tabs, pinned in the footer.** Each tab used to be a
 * `SectionPanel` with its own Save and an inline "Saved" chip, inside a body that
 * scrolled — so on a short tab the Save floated mid-dialog, and on a long one it
 * scrolled away. Saving now sends what changed on either tab, says "Saved" in a
 * toast the way the card designer does, and closes.
 *
 * **The form is its own component, mounted only while the dialog is open**, so
 * the draft starts from the map every time it opens and Cancel means discard.
 *
 * **Both panels stay mounted** while it is open. React Aria unmounts the
 * unselected panel by default, which would throw away a half-built group on a tab
 * switch. `shouldForceMount` keeps both; React Aria marks the other one `inert`,
 * and `hidden` takes it off screen.
 */
export function VocabularyDialog({
  map,
  places,
  isOpen,
  onOpenChange,
}: {
  map: AppMap;
  places: Place[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      scroll="inside"
      dialogClassName="steady sm:h-[min(46rem,100%)] sm:max-w-2xl"
      drawerClassName="h-[92dvh]"
    >
      <VocabularyForm map={map} places={places} onSaved={() => onOpenChange(false)} />
    </ResponsiveDialog>
  );
}

function VocabularyForm({
  map,
  places,
  onSaved,
}: {
  map: AppMap;
  places: Place[];
  onSaved: () => void;
}) {
  const draft = useVocabularyDraft(map);
  const [tab, setTab] = useState<VocabularyTab>("filters");

  const save = async () => {
    try {
      const failedTab = await draft.save();
      if (failedTab) {
        setTab(failedTab);
        return;
      }
      toast.success("Saved", {
        description: "Publish the map to show these changes to visitors.",
      });
      onSaved();
    } catch (error) {
      toastError(error, "Couldn't save your tags and fields");
    }
  };

  // A validation failure belongs to one tab; show it there, and go there.
  const problemFor = (which: VocabularyTab) =>
    draft.problem?.tab === which ? <ErrorMessage error={draft.problem.message} /> : null;

  return (
    <>
      <ResponsiveDialog.Header className="gap-1">
        <ResponsiveDialog.Heading>Tags &amp; fields</ResponsiveDialog.Heading>
        <p className="text-sm text-muted">
          What visitors can filter by, and the extra details each location carries.
        </p>
      </ResponsiveDialog.Header>

      <ResponsiveDialog.Body>
        <Tabs
          className="w-full gap-4"
          selectedKey={tab}
          onSelectionChange={(key) => setTab(key as VocabularyTab)}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Tags and fields">
              <Tabs.Tab id="filters" className="gap-2">
                <Filter aria-hidden="true" className="size-4 shrink-0" />
                Filters
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="fields" className="gap-2">
                <ListPlus aria-hidden="true" className="size-4 shrink-0" />
                Extra fields
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel
            id="filters"
            shouldForceMount
            className="mt-0 space-y-4 p-0 data-[inert=true]:hidden"
          >
            {problemFor("filters")}
            <TagGroupEditor
              draft={draft.tagGroups}
              places={places}
              onChange={draft.setTagGroups}
            />
          </Tabs.Panel>
          <Tabs.Panel
            id="fields"
            shouldForceMount
            className="mt-0 space-y-4 p-0 data-[inert=true]:hidden"
          >
            {problemFor("fields")}
            <CustomFieldEditor
              draft={draft.fields}
              places={places}
              onChange={draft.setFields}
            />
          </Tabs.Panel>
        </Tabs>
      </ResponsiveDialog.Body>

      <ResponsiveDialog.Footer>
        <Button slot="close" variant="tertiary">
          Cancel
        </Button>
        <Button
          isDisabled={!draft.isDirty}
          isPending={draft.isSaving}
          onPress={save}
        >
          Save changes
        </Button>
      </ResponsiveDialog.Footer>
    </>
  );
}
