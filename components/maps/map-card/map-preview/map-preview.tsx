import { MAP_PANE_CLASS } from "@/components/maps/map-row-layout";
import type { MapStyleKey } from "@/lib/map/style";
import {
  themeImagesFor,
  themeImageSrc,
  themeImageSrcSet,
} from "@/lib/map/theme-images";

/**
 * The map's theme, on the left of its row: a picture of the basemap it is drawn
 * on, with nothing of the map's own on it and no text.
 *
 * The pictures are static files rendered once in development
 * (lib/map/theme-images.ts), so this asks no tile host for anything. While one
 * loads the pane is its plain surface colour. There is deliberately no drawn
 * fallback: the swatch that used to sit here is a 64×40 drawing and read as a
 * zoomed-in street once stretched across the pane. A missing picture is caught
 * by lib/map/theme-images.test.ts instead, before it ships.
 *
 * Auto has two pictures and CSS picks one off the dashboard's `.dark` class, so
 * the right one is there at first paint with no script involved.
 *
 * `alt=""`: the card's title and its "Basemap" line already say what this is.
 */
export function MapPreview({
  style,
  children,
}: {
  style: MapStyleKey;
  /** Drawn over the picture — the status chip. */
  children?: React.ReactNode;
}) {
  const images = themeImagesFor(style);

  return (
    <div className={MAP_PANE_CLASS}>
      <ThemeImage name={images.light} className={images.dark ? "dark:hidden" : undefined} />
      {images.dark ? <ThemeImage name={images.dark} className="hidden dark:block" /> : null}

      {children}
    </div>
  );
}

function ThemeImage({ name, className = "" }: { name: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small static webp with its own srcset; next/image adds nothing here.
    <img
      src={themeImageSrc(name, 1)}
      srcSet={themeImageSrcSet(name)}
      alt=""
      draggable={false}
      decoding="async"
      className={`absolute inset-0 size-full select-none object-cover ${className}`}
    />
  );
}
