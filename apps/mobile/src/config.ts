/**
 * Season-one switches. Flip in code and ship a build; nothing here is remote.
 */
export const features = {
  /**
   * Email sign-in needs a mail sender the project does not have yet, and
   * Supabase's built-in one is for development only. Sign in with Apple is the
   * one door on iPhone in season one (ADR 0012). The email code path stays in
   * the repo for the day a sending domain exists.
   */
  emailSignIn: false,
} as const;
