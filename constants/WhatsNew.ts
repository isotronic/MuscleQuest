import Constants from "expo-constants";

export interface WhatsNewEntry {
  version: number;
  message: string;
}

export const CURRENT_APP_VERSION =
  Constants.expoConfig?.android?.versionCode || 0;

export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    version: 1300,
    message: `
📝 New Feature: Notes!

You can now add notes to exercises, workouts and plans. Use this to jot down technique tips, machine settings, reminders, or anything else that helps you crush your session!
`,
  },
  {
    version: 1600,
    message: `
🔥 New Feature: To Failure Sets!

You can now mark a set "to failure", instead of adding a rep range, which is especially useful for isolation machine, dumbbell, or bodyweight exercises, when you want to push yourself to the limit.
`,
  },
];
