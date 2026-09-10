/**
 * What to call someone in a greeting.
 *
 * Appwrite lets `name` be empty, and an account created through Google carries
 * whatever Google holds — often a full name where our own form would have
 * collected one word. "Hi ," is worse than either, so the address is the floor.
 *
 * Shared rather than repeated in each template's caller: three messages open with
 * this and the way they start disagreeing is by each deciding for itself.
 */
export function greetingName(name: string, email: string): string {
  const trimmed = name.trim();
  if (!trimmed) return email;

  return trimmed.split(/\s+/)[0]!;
}
