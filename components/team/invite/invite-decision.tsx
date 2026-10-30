"use client";

import { Button } from "@heroui/react";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ErrorMessage } from "@/components/ui/error-message";
import { useAcceptInviteLink, useDeclineInviteLink } from "@/lib/query/team";
import { ROLE_DESCRIPTION, ROLE_LABEL, type MemberRole } from "@/lib/team/roles";

/**
 * Join or decline. Joining lands on the team's maps by a full load
 * (`useAcceptInviteLink`), so there is no "joined" state to draw here; declining
 * stays, because there is nowhere obvious to go next.
 */
export function InviteDecision({
  token,
  title,
  role,
  inviterName,
}: {
  token: string;
  title: string;
  role: MemberRole;
  inviterName: string;
}) {
  const accept = useAcceptInviteLink();
  const decline = useDeclineInviteLink();

  if (decline.isSuccess) {
    return (
      <AuthShell
        title="Invitation declined"
        description="Nothing changed. If that was a mistake, ask whoever sent it for a new one."
        footer={
          <Link href="/maps" className="text-foreground underline">
            Go to your maps
          </Link>
        }
      >
        {null}
      </AuthShell>
    );
  }

  const busy = accept.isPending || accept.isSuccess || decline.isPending;

  return (
    <AuthShell
      title={title}
      description={`${inviterName || "Someone"} invited you as ${articled(ROLE_LABEL[role])}. You'll see every map on the team.`}
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-surface-secondary px-4 py-3 text-sm text-muted">
          <span className="font-medium text-foreground">{ROLE_LABEL[role]}.</span>{" "}
          {ROLE_DESCRIPTION[role]}
        </p>

        {accept.isError ? <ErrorMessage error={accept.error} /> : null}
        {decline.isError ? <ErrorMessage error={decline.error} /> : null}

        <div className="space-y-3">
          <Button
            fullWidth
            isPending={accept.isPending || accept.isSuccess}
            isDisabled={busy}
            onPress={() => accept.mutate(token)}
          >
            Join team
          </Button>
          <Button
            fullWidth
            variant="tertiary"
            isPending={decline.isPending}
            isDisabled={busy}
            onPress={() => decline.mutate(token)}
          >
            Decline
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}

function articled(label: string): string {
  return /^[AEIOU]/i.test(label) ? `an ${label.toLowerCase()}` : `a ${label.toLowerCase()}`;
}
