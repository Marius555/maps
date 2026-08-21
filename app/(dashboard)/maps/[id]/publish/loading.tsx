import { Container, Measure } from "@/components/ui/container";
import { SectionPanelSkeleton } from "@/components/ui/skeletons";

export default function PublishLoading() {
  return (
    <Container>
      <Measure className="space-y-6">
        <SectionPanelSkeleton rows={1} />
        <SectionPanelSkeleton rows={2} />
      </Measure>
    </Container>
  );
}
