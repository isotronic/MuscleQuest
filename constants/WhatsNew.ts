export interface WhatsNewEntry {
  version: number;
  message: string;
}

export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    version: 2601,
    message: `
🎯 Improved: Smarter Exercise Filters!

When replacing an exercise, the filter now automatically preselects the target muscle to match what you're replacing. Only relevant filters are shown based on your current selection, making it much faster to find the right alternative.
`,
  },
  {
    version: 2602,
    message: `
🐛 Fixed: Workout Session Buttons & Edit Set Modal!

Fixed a bug where all buttons (increment/decrement, next/previous set, complete set) would stop working after completing a set. Also fixed an error in the edit set modal. Set transitions now happen instantly for a smoother workout flow.
`,
  },
  {
    version: 2603,
    message: `
🔔 New: In-App Update Notifications!

A new update modal now appears when an over-the-air update is available, so you always know when improvements have been downloaded and are ready to apply.
`,
  },
  {
    version: 2604,
    message: `
📋 New: View Workout Details from the Home Screen!

You can now tap any recent workout on the home screen to view its full details. Each workout and set overview also has a new details button for quick access to exercise information.
`,
  },
  {
    version: 2605,
    message: `
↕️ New: Reorder Workouts in Your Plan!

You can now reorder workouts directly in the plan creation screen and workout cards, giving you full control over your training schedule layout.
`,
  },
  {
    version: 2606,
    message: `
🐛 Fixed: Various Bug Fixes & Improvements!

Fixed the rest timer notification not triggering correctly, exercise name wrapping in the workout session, the workout completion circle width, notes not updating correctly while typing, and workout details sometimes opening in the wrong tab. Workouts now load faster thanks to internal performance improvements.
`,
  },
  {
    version: 2607,
    message: `
🏋️ New: Single Workouts & Quick Workouts!

Create standalone workouts outside of your training plans — perfect for flexible training sessions, mobility work, or anything ad hoc. Find them on the Plans screen.

Or start a Quick Workout from the home screen, add exercises on the fly, and optionally save it as a standalone workout when you're done.
`,
  },
  {
    version: 2608,
    message: `
📅 New: Weekly Schedule for Your Plan!

You can now assign workouts to specific days of the week directly in the plan editor. Tap any day to pick a workout or mark it as a rest day. Use the auto-suggest button to instantly generate a balanced schedule based on your weekly goal.
`,
  },
];

// Derived from WHATS_NEW_ENTRIES to avoid drift between the constant and entries
// Defaults to 0 if the array is empty
export const CURRENT_WHATS_NEW_VERSION =
  WHATS_NEW_ENTRIES.length > 0
    ? WHATS_NEW_ENTRIES.reduce(
        (max, entry) => (entry.version > max ? entry.version : max),
        0,
      )
    : 0;
