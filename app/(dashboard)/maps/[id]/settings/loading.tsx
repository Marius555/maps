import { Container, Measure } from "@/components/ui/container";
import { PageHeaderSkeleton, SectionPanelSkeleton } from "@/components/ui/skeletons";

export default function SettingsLoading() {
  return (
    <Container>
      <Measure className="space-y-6">
        <PageHeaderSkeleton />
        <SectionPanelSkeleton rows={2} />
        <SectionPanelSkeleton rows={3} />
        <SectionPanelSkeleton rows={0} />
      </Measure>
    </Container>
  );
}
