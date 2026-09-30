import { Chip } from "@heroui/react";
import { ShieldCheck } from "lucide-react";

/**
 * Says "this is the operator console" where the customer chrome says the plan
 * (`PlanBadge`) — same chip, same place beside the logo — so the two shells
 * are told apart by one word rather than by two designs.
 */
export function AdminBadge() {
  return (
    <Chip size="sm" variant="soft" color="default" className="shrink-0">
      <ShieldCheck aria-hidden="true" className="size-3 shrink-0" />
      <Chip.Label>Admin</Chip.Label>
    </Chip>
  );
}
