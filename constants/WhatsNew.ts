import Constants from "expo-constants";

export interface WhatsNewEntry {
  version: number;
  message: string;
}

export const CURRENT_APP_VERSION =
  Constants.expoConfig?.android?.versionCode || 0;

export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    version: 1704,
    message: `
🎯 Improved: Smart Filter Preselection!

When replacing an exercise in your workout or plan, the body part filter is now automatically preselected to match the exercise you're replacing. This makes it much faster to find similar alternatives without extra tapping!
`,
  },
];
