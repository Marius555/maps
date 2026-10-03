"use client";

import { Button, Modal } from "@heroui/react";
import { X } from "lucide-react";
import { useCallback, useState } from "react";

import { LightboxNav } from "./lightbox-nav";
import { useLightboxKeys } from "./use-lightbox-keys";

/**
 * A location's photos, full screen, one at a time — the dashboard's twin of
 * embed/src/lightbox.ts, opened from the card's photo.
 *
 * One look in both: a dark field the photo sits on, the count at the top,
 * arrows on the edges, an X with no box behind it. Pressing the dark closes it,
 * as Escape does; both are the Modal's own.
 *
 * Mounted per opening (`photos` non-null), so the index starts at the first
 * photo each time without an effect resetting it.
 */
export function PhotoLightbox({
  photos,
  onClose,
}: {
  photos: string[] | null;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop
      isOpen={photos !== null}
      onOpenChange={(open) => !open && onClose()}
      className="bg-black/90"
    >
      <Modal.Container size="full">
        <Modal.Dialog aria-label="Photos" className="bg-transparent p-0 text-white shadow-none">
          {photos ? <LightboxBody photos={photos} onClose={onClose} /> : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function LightboxBody({ photos, onClose }: { photos: string[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);

  // Wraps, so back from the first reaches the last rather than dead-ending.
  const step = useCallback(
    (delta: number) => setIndex((at) => (at + delta + photos.length) % photos.length),
    [photos.length],
  );

  useLightboxKeys(step);

  return (
    <div
      className="relative grid h-full w-full place-items-center"
      // A press on the dark around the photo closes, the way people expect.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[index]}
        alt=""
        className="max-h-[86vh] max-w-[92vw] rounded-md object-contain"
      />

      <LightboxNav index={index} count={photos.length} onStep={step} />

      <Button
        aria-label="Close"
        isIconOnly
        variant="ghost"
        onPress={onClose}
        className="absolute end-3 top-3 size-11 min-w-0 bg-transparent text-white/80 hover:bg-transparent hover:text-white"
      >
        <X aria-hidden="true" className="size-6" strokeWidth={2.25} />
      </Button>
    </div>
  );
}
