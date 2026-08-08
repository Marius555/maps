/** The only shape of "user" the app knows about. */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};
