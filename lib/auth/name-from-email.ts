/**
 * The name a new account starts with: the part of its address before the `@`.
 *
 * Signup asks for no name (`signupSchema`), and an empty one would leave the
 * account menu and every greeting with nothing to say. `maria@gmail.com` is
 * `maria` until she changes it in Settings → General.
 *
 * The last `@`, because a quoted local part may contain one; 128 characters,
 * because that is Appwrite's limit and `personName`'s. The whole address is the
 * floor for the one shape that leaves nothing in front of the `@`.
 */
export function nameFromEmail(email: string): string {
  const at = email.lastIndexOf("@");
  const local = (at < 0 ? email : email.slice(0, at)).trim();

  return (local || email.trim()).slice(0, 128);
}
