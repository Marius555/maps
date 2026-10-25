"use client";

import { Drawer } from "@heroui/react";
import { X } from "lucide-react";

import { useSidebar } from "@/components/layout/sidebar/sidebar-context";
import { IconButton } from "@/components/ui/icon-button";
import { MD_DOWN, useMediaQuery } from "@/lib/ui/use-media-query";
import { NotificationsPanel } from "./notifications-panel";

/**
 * The inbox over the page, opened from the sidebar's Notifications row: down the
 * right edge on a wide screen, rising from the bottom below `md` — the range
 * where the app already has its mobile header and nav drawer.
 *
 * One placement is rendered, never both, for the reason `ResponsiveDialog`
 * gives: two React Aria overlays are two focus traps. The server answers
 * "wide", but the drawer cannot be open before hydration, so nothing is drawn on
 * the wrong side of that answer.
 *
 * Mounted once, in the shell, so it opens over whatever page is under it — the
 * map editor included — and a message from us never costs the owner their place.
 */
export function NotificationsDrawer() {
  const { isNotificationsOpen, setNotificationsOpen } = useSidebar();
  const isSheet = useMediaQuery(MD_DOWN);
  const close = () => setNotificationsOpen(false);

  return (
    <Drawer.Backdrop isOpen={isNotificationsOpen} onOpenChange={setNotificationsOpen}>
      {isSheet ? (
        /* `max-h-full` against HeroUI's `85vh`, as in `ResponsiveDialog`: `full`
           resolves against the visual viewport, so the sheet still fits under a
           phone's browser chrome. `Drawer.Handle` is what drag-to-dismiss pulls. */
        <Drawer.Content placement="bottom" className="max-h-full">
          <Drawer.Dialog className="flex max-h-[85dvh] flex-col pt-3">
            <Drawer.Handle />
            <Contents onNavigate={close} />
          </Drawer.Dialog>
        </Drawer.Content>
      ) : (
        /* The width goes on the dialog: the content is a full-viewport flex row
           that only pushes the dialog to the right edge. */
        <Drawer.Content placement="right">
          <Drawer.Dialog className="flex h-full w-[26rem] max-w-[90vw] flex-col">
            <Contents onNavigate={close} />
          </Drawer.Dialog>
        </Drawer.Content>
      )}
    </Drawer.Backdrop>
  );
}

function Contents({ onNavigate }: { onNavigate: () => void }) {
  return (
    <>
      <Drawer.Header className="flex-row items-center justify-between gap-2">
        <Drawer.Heading className="text-base font-semibold">Notifications</Drawer.Heading>
        <IconButton
          slot="close"
          label="Close notifications"
          icon={X}
          placement="bottom"
          className="shrink-0"
        />
      </Drawer.Header>

      <Drawer.Body className="min-h-0 flex-1">
        <NotificationsPanel onNavigate={onNavigate} />
      </Drawer.Body>
    </>
  );
}
