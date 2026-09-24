"use client";

import { Modal, Tabs } from "@heroui/react";
import { Filter, ListPlus } from "lucide-react";

import { CustomFieldEditor } from "@/components/fields/custom-field-editor";
import { TagGroupEditor } from "@/components/tags/tag-group-editor";
import type { AppMap, Place } from "@/lib/repositories/types";

/**
 * The map's vocabulary — its filter groups and its extra fields — in one dialog
 * on the Locations page.
 *
 * They lived on a per-map Settings page of their own, the only things there
 * besides the name and Delete (both in the map card's menu now). They describe
 * locations, so they sit beside the list of them.
 *
 * **Both panels stay mounted.** Each editor holds an unsaved draft in state, and
 * React Aria unmounts the unselected panel by default — switching tabs would
 * throw away a half-built group without a word. `shouldForceMount` keeps both;
 * React Aria marks the other one `inert`, and `hidden` takes it off screen.
 *
 * The editors' panels are flattened (no border, no fill): a bordered card inside
 * a dialog is two frames around one form.
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
  const flat = "rounded-none border-0 bg-transparent";

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container scroll="inside">
        <Modal.Dialog className="h-full sm:h-[min(46rem,100%)] sm:max-w-2xl">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Tags &amp; fields</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="px-0">
            <Tabs className="w-full gap-0">
              <Tabs.ListContainer className="px-4 sm:px-6">
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

              <Tabs.Panel id="filters" shouldForceMount className="mt-0 p-0 data-[inert=true]:hidden">
                <TagGroupEditor map={map} places={places} className={flat} />
              </Tabs.Panel>
              <Tabs.Panel id="fields" shouldForceMount className="mt-0 p-0 data-[inert=true]:hidden">
                <CustomFieldEditor map={map} places={places} className={flat} />
              </Tabs.Panel>
            </Tabs>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
