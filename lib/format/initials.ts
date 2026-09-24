/**
 * Initials for an avatar: the first and last name's first letters, one name's
 * first two, or the email's first letter when there is no name.
 *
 * Shared by the account menu and the Profile section, so the two avatars a
 * person sees on one screen always agree.
 */
export function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return email.slice(0, 1).toUpperCase() || "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
