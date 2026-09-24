import { Skeleton } from "@heroui/react";

import { SettingsSection } from "@/components/user-settings/section/settings-section";

/** Four meter cards, two across, each at the height a real one lands at. */
export default function UsageSettingsLoading() {
  return (
    <SettingsSection
      title="Usage"
      description="Against what your plan allows. Everything here is enforced when you save, not just drawn. Need more room? Compare plans."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} className="h-48 w-full rounded-3xl" />
        ))}
      </div>
    </SettingsSection>
  );
}
