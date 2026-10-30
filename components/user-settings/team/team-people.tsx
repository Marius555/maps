"use client";

import { Chip } from "@heroui/react";
import { UserX } from "lucide-react";

import { SettingsRow, SettingsRows } from "@/components/user-settings/section/settings-row";
import { canManage, ROLE_LABEL, type MemberRole, type WorkspaceRole } from "@/lib/team/roles";
import type { TeamPerson } from "@/lib/team/types";
import { MemberRoleSelect } from "./member-role-select";
import { RemoveMemberButton } from "./remove-member-button";

/**
 * The owner, then every member, oldest first — the order seats are held in.
 *
 * Each row offers only what the viewer may do to it (`canManage`): a role menu
 * and Remove for people they manage, a plain role chip for everybody else. The
 * server makes the same check, so a control missing here is a courtesy, not the
 * rule.
 */
export function TeamPeople({
  people,
  viewerRole,
  viewerId,
}: {
  people: TeamPerson[];
  viewerRole: WorkspaceRole;
  viewerId: string;
}) {
  return (
    <SettingsRows>
      {people.map((person) => (
        <PersonRow
          key={person.userId}
          person={person}
          viewerRole={viewerRole}
          isSelf={person.userId === viewerId}
        />
      ))}
    </SettingsRows>
  );
}

function PersonRow({
  person,
  viewerRole,
  isSelf,
}: {
  person: TeamPerson;
  viewerRole: WorkspaceRole;
  isSelf: boolean;
}) {
  const stored = person.storedRole === "owner" ? null : (person.storedRole as MemberRole);
  // Nobody manages the owner, and nobody manages themselves.
  const manageable = stored !== null && !isSelf && canManage(viewerRole, stored, null);
  const overSeats = person.role !== person.storedRole;

  const details = [
    person.missing ? "This account was deleted. Remove it to free the seat." : person.email,
    overSeats ? "View only until a seat frees up" : null,
  ].filter(Boolean);

  return (
    <SettingsRow
      label={
        <span className="flex min-w-0 items-center gap-2">
          {person.missing ? (
            <UserX aria-hidden="true" className="size-4 shrink-0 text-muted" />
          ) : null}
          <span className="truncate">
            {person.name}
            {isSelf ? <span className="text-muted"> (you)</span> : null}
          </span>
        </span>
      }
      description={details.join(" · ")}
    >
      {manageable && stored ? (
        <div className="flex flex-wrap items-center gap-2">
          <MemberRoleSelect
            userId={person.userId}
            name={person.name}
            role={stored}
            viewerRole={viewerRole}
          />
          <RemoveMemberButton userId={person.userId} name={person.name} />
        </div>
      ) : (
        <Chip size="sm" variant="soft" color={person.role === "owner" ? "accent" : "default"}>
          {ROLE_LABEL[person.storedRole]}
        </Chip>
      )}
    </SettingsRow>
  );
}
