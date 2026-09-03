import { Container } from "@/components/ui/container";
import { SectionPanelSkeleton } from "@/components/ui/skeletons";

/**
 * The same `Container` size *and the same height rules* as the page.
 *
 * Both matter: a skeleton at a different width steps sideways the moment the
 * real page arrives, which reads as the page reloading rather than as it
 * finishing. The height is the same story one axis over — the designer is one
 * viewport-tall workspace at `lg`, so a skeleton that hugged its content would
 * play at a third of the height and then snap open. Every string here is
 * repeated from `page.tsx` and `card-designer.tsx` and has to keep being.
 */
export default function CardLoading() {
  return (
    <Container className="flex min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:h-[calc(100dvh-3rem)] lg:flex-none">
        <div className="h-4 w-full max-w-lg shrink-0 rounded bg-default" />

        <div className="grid min-h-0 gap-4 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-h-64 rounded-xl bg-default/40 lg:min-h-0" />
          <SectionPanelSkeleton rows={4} />
        </div>
      </div>
    </Container>
  );
}
