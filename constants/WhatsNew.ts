export interface WhatsNewEntry {
  version: number;
  message: string;
}

// Increment this version whenever you push an EAS update with user-facing changes
export const CURRENT_WHATS_NEW_VERSION = 2505;

export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    version: 2504,
    message: `
🎯 Improved: Smart Filter Preselection!

When replacing an exercise in your workout or plan, the body part filter is now automatically preselected to match the exercise you're replacing. This makes it much faster to find similar alternatives without extra tapping!
`,
  },
  {
    version: 2505,
    message: `
🐛 Fixed: Workout Session Button Issues!

Fixed a critical bug where all buttons (increment/decrement, next/previous set, complete set) would stop working after completing a set during a workout. 

The broken sliding animations between sets have been removed entirely. Set transitions now happen instantly, making the workout flow smoother and more responsive.
`,
  },
];
