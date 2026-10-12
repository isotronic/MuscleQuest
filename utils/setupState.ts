// The first-run setup (app/setup.tsx), tracked by the setupDone setting.
// Free of the database and Lingui so layouts and the data layer share it.

export const SETUP_DONE_KEY = "setupDone";

export const SetupState = {
  /** A new install: the (app) layout opens setup after the login screen. */
  pending: "pending",
  /** An install from before setup existed: home offers it as a card. */
  offered: "offered",
  /** Finished, or the home card was dismissed. */
  done: "done",
} as const;
