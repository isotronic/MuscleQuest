// The first-run setup (app/setup.tsx), tracked by the setupDone setting.
// Free of the database and Lingui so layouts and the data layer share it.

export const SETUP_DONE_KEY = "setupDone";

export const SetupState = {
  /** A new install: the (app) layout opens the welcome screen. */
  pending: "pending",
  /** An install from before setup existed: home offers it as a card. */
  offered: "offered",
  /** Finished, or the home card was dismissed. */
  done: "done",
} as const;

/**
 * Where the (app) layout sends a user who has not finished onboarding: the
 * welcome screen while setup is pending, then the login screen until it has
 * been shown once. Null lets them through, or waits while settings load.
 */
export const onboardingRedirect = (
  settings: { setupDone?: string; loginShown?: string } | undefined,
): "/welcome" | "/login" | null => {
  if (!settings) return null;
  if (settings.setupDone === SetupState.pending) return "/welcome";
  if (!settings.loginShown) return "/login";
  return null;
};
