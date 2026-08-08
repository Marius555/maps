import { Skeleton } from "@heroui/react";

import { Container, Measure } from "@/components/ui/container";
import { PageHeaderSkeleton, SectionPanelSkeleton } from "@/components/ui/skeletons";

export default function ImportLoading() {
  return (
    <Container>
      <Measure className="space-y-6">
        <PageHeaderSkeleton />
        {/* The File → Columns → Addresses → Review step trail. */}
        <Skeleton className="h-4 w-56 rounded-lg" />
        <SectionPanelSkeleton rows={1} />
      </Measure>
    </Container>
  );
}
