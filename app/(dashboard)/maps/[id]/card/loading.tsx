import { Container } from "@/components/ui/container";
import { SectionPanelSkeleton } from "@/components/ui/skeletons";

/**
 * The same `Container` size *and the same height rules* as the page.
 *
 * Both matter: a skeleton at a different width steps sideways the moment the
 * real page arrives, which reads as the page reloading rather than as it
 * finishing. The height is the same story one axis over — the designer is one
 * viewport-tall workspace at every width now, so a skeleton that hugged its
 * content would play at a third of the height and then snap open. Every string
 * here is repeated from `page.tsx` and `card-designer.tsx` and has to keep being.
 *
 * Below `lg` the sidebar is a bottom sheet over the card rather than a column of
 * the page, so the skeleton draws only its shut strip — 4rem along the bottom,
 * the same `--sheet-peek` the real one parks at.
 */
export default function CardLoading() {
  return (
    <Container className="flex min-h-0 flex-col">
      <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-none flex-col gap-3 max-md:h-[calc(100dvh-6.5rem)]">
        <div className="relative grid min-h-0 gap-4 max-lg:flex-1 max-lg:grid-rows-[minmax(0,1fr)] max-lg:overflow-hidden lg:flex-1 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-h-64 rounded-xl bg-default/40 max-lg:min-h-0 lg:min-h-0" />

          <div className="max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:h-[var(--sheet-peek)] max-lg:overflow-hidden max-lg:rounded-t-xl max-lg:border max-lg:border-border max-lg:bg-surface">
            <div className="max-lg:h-[var(--sheet-peek)] max-lg:border-b max-lg:border-border lg:hidden">
              <div className="flex h-5 items-center justify-center">
                <span className="h-1 w-10 rounded-full bg-border" />
              </div>
            </div>

            <div className="max-lg:hidden">
              <SectionPanelSkeleton rows={4} />
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
