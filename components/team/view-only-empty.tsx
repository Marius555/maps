import { Eye } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";

/**
 * What a viewer meets on a page that only exists to change something — the
 * import wizard. An invitation to act, as every empty state is (§8): the act
 * open to a viewer is going back, and asking for more is a sentence away.
 */
export function ViewOnlyEmpty({
  title,
  backHref,
  backLabel,
}: {
  title: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto my-auto w-full max-w-lg py-10">
      <EmptyState
        icon={Eye}
        title={title}
        description="You can see this team's maps but not change them. Ask an admin to make you an editor."
        action={<LinkButton href={backHref}>{backLabel}</LinkButton>}
      />
    </div>
  );
}
