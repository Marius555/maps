import { button, el, icon } from "./dom";
import { t } from "./i18n";

/**
 * A place's photos, full screen, one at a time.
 *
 * **A `<dialog>` opened with `showModal()`, and that is most of the feature.**
 * The embed lives inside a stranger's page, under whatever `transform`,
 * `overflow` and `z-index` their layout put round it; the top layer escapes
 * all three, so the photos really are over the whole window and not clipped to
 * the map. Escape, the focus trap and focus going back to the photo pressed
 * come with it — each would be bytes of our own otherwise.
 *
 * Appended to the embed's root rather than `<body>`, so it inherits the root's
 * type, and removed on close rather than kept: a visitor opens it rarely, and a
 * dialog left in the page is one more node in somebody else's DOM.
 *
 * Only the photo on screen has a `src`, for `buildGallery`'s reason — eight
 * photos must not start eight downloads on a phone.
 */
export function openLightbox(photos: string[], host: Element): void {
  const dialog = el("dialog", "lm-lightbox");
  const image = el("img", "lm-lightbox__photo");
  let at = 0;

  const show = (next: number) => {
    // Wraps, so back from the first reaches the last rather than dead-ending.
    at = (next + photos.length) % photos.length;
    image.src = photos[at];
    // No visible counter — asked to go — so the position lives where a screen
    // reader still finds it.
    image.alt = at + 1 + " / " + photos.length;
  };

  const control = (side: string, name: string, path: string, press: () => void) => {
    const node = button("lm-lightbox__button lm-lightbox__button--" + side, "");

    node.setAttribute("aria-label", name);
    node.title = name;
    node.append(icon([path], 2));
    node.onclick = press;

    return node;
  };

  dialog.append(image, control("close", t("dismiss"), "M18 6 6 18M6 6l12 12", () => dialog.close()));

  if (photos.length > 1) {
    dialog.append(
      control("back", t("previousPhoto"), "M15 18 9 12l6-6", () => show(at - 1)),
      control("on", t("nextPhoto"), "m9 18 6-6-6-6", () => show(at + 1)),
    );
    dialog.onkeydown = (event) => {
      if (event.key === "ArrowLeft") show(at - 1);
      if (event.key === "ArrowRight") show(at + 1);
    };
  }

  // The dialog is the whole window, so a press on it and not on a child is a
  // press on the dark around the photo — which is where people expect to close.
  dialog.onclick = (event) => {
    if (event.target === dialog) dialog.close();
  };
  dialog.onclose = () => dialog.remove();

  show(0);
  host.append(dialog);
  dialog.showModal();
}
