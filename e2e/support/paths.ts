/** Where the setup project saves the signed-in session every other test reuses. */
export const AUTH_FILE = "playwright/.auth/user.json";

/**
 * The second test account's session (`E2E_EMAIL_2`), for the tests that ask
 * whether one account can reach another's data. Absent when the env is unset.
 */
export const SECOND_AUTH_FILE = "playwright/.auth/user-2.json";

/**
 * The operator console's session. Saved once because its login allows five
 * tries per address per quarter hour. Absent when `E2E_ADMIN_PASSWORD` is unset.
 */
export const ADMIN_AUTH_FILE = "playwright/.auth/admin.json";

/** Every map a test makes starts with this, so teardown can find leftovers. */
export const E2E_PREFIX = "e2e-";
