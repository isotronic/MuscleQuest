import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

export interface WhatsNewEntry {
  version: number;
  message: MessageDescriptor;
}

export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    version: 2601,
    message: msg`
🎯 Improved: Smarter Exercise Filters!

When replacing an exercise, the filter now automatically preselects the target muscle to match what you're replacing. Only relevant filters are shown based on your current selection, making it much faster to find the right alternative.
`,
  },
  {
    version: 2602,
    message: msg`
🐛 Fixed: Workout Session Buttons & Edit Set Modal!

Fixed a bug where all buttons (increment/decrement, next/previous set, complete set) would stop working after completing a set. Also fixed an error in the edit set modal. Set transitions now happen instantly for a smoother workout flow.
`,
  },
  {
    version: 2603,
    message: msg`
🔔 New: In-App Update Notifications!

A new update modal now appears when an over-the-air update is available, so you always know when improvements have been downloaded and are ready to apply.
`,
  },
  {
    version: 2604,
    message: msg`
📋 New: View Workout Details from the Home Screen!

You can now tap any recent workout on the home screen to view its full details. Each workout and set overview also has a new details button for quick access to exercise information.
`,
  },
  {
    version: 2605,
    message: msg`
↕️ New: Reorder Workouts in Your Plan!

You can now reorder workouts directly in the plan creation screen and workout cards, giving you full control over your training schedule layout.
`,
  },
  {
    version: 2606,
    message: msg`
🐛 Fixed: Various Bug Fixes & Improvements!

Fixed the rest timer notification not triggering correctly, exercise name wrapping in the workout session, the workout completion circle width, notes not updating correctly while typing, and workout details sometimes opening in the wrong tab. Workouts now load faster thanks to internal performance improvements.
`,
  },
  {
    version: 2607,
    message: msg`
🏋️ New: Single Workouts & Quick Workouts!

Create standalone workouts outside of your training plans — perfect for flexible training sessions, mobility work, or anything ad hoc. Find them on the Plans screen.

Or start a Quick Workout from the home screen, add exercises on the fly, and optionally save it as a standalone workout when you're done.
`,
  },
  {
    version: 2608,
    message: msg`
📅 New: Weekly Schedule for Your Plan!

You can now assign workouts to specific days of the week directly in the plan editor. Tap any day to pick a workout or mark it as a rest day. Use the auto-suggest button to instantly generate a balanced schedule based on your weekly goal.
`,
  },
  {
    version: 2609,
    message: msg`
🔗 New: Supersets!

Pair two exercises together as a superset directly in the plan editor. Sets are kept in sync between both exercises, and supersets are clearly grouped with a visual indicator throughout the app.
`,
  },
  {
    version: 2610,
    message: msg`
✨ New: Workout Session Animations!

Navigating between sets now features smooth slide transitions. Swipe left or right to move between sets, or use the pre-existing arrow buttons for the same effect.
`,
  },
  {
    version: 2611,
    message: msg`
📊 New: Workout Summary!

After completing a workout, you'll now see a full summary of your session: total duration, sets, and volume, plus a comparison against your previous session. Tap any exercise to expand its individual sets and weights.
`,
  },
  {
    version: 2612,
    message: msg`
⏱️ New: Adjustable Rest Timer!

A new slide-in panel lets you fine-tune your rest duration on the fly during a workout. Your custom rest time is saved per set, so each set remembers exactly how long you like to rest.
`,
  },
  {
    version: 2613,
    message: msg`
🔵 New: Exercise Timer Modal!

Time-based exercises now show a dedicated countdown modal with a progress ring, making it easy to track your effort and stay on pace during timed sets.
`,
  },
  {
    version: 2614,
    message: msg`
↕️ New: Reorder Exercises in the Workout Overview!

You can now drag and drop exercises and supersets to reorder them directly from the workout overview screen during a session.
`,
  },
  {
    version: 2615,
    message: msg`
💾 New: Save Workout Changes Back to Your Plan!

When you finish a session where you added, removed, or reordered exercises, or sets, you'll be prompted to save those changes back to the original plan or standalone workout, keeping your training up to date automatically.
`,
  },
  {
    version: 2616,
    message: msg`
📊 New: Improved Stats Screen!

The stats screen has been redesigned with a fresh new look and improved insights. Explore your training history with better charts, clearer summaries, and more detailed breakdowns of your progress over time.
`,
  },
  {
    version: 2617,
    message: msg`
📏 New: Distance Tracking for Custom Exercises!

Custom exercises can now use a distance tracking type, perfect for cardio and conditioning movements like runs, rows, or sled pushes. Log distance for your sets and get insights on progression just like any other exercise.
`,
  },
  {
    version: 2618,
    message: msg`
🔔 New: Workout Reminder Notifications!

Never miss a session. Set reminder notifications for your workouts directly from the app. Choose which days you want to be reminded, and pick a time to get started.
`,
  },
  {
    version: 2619,
    message: msg`
📈 New: Exercise History in the Info Screen!

The exercise info screen now includes a full history of every time you've performed that exercise, showing weights, reps, time, and distance for each set from past sessions. Access it during a workout, from your plan, or anywhere else exercise info is available.
`,
  },
  {
    version: 2620,
    message: msg`
⚙️ New: Three New Stats Settings!

Customise how your volume and stats are calculated with three new options in Settings:

• Exclude warm-up sets from stats so they don't skew your numbers.
• Double dumbbell weight automatically, so you can log the weight of one dumbbell and have the total counted for you.
• Double reps for single arm/leg exercises, so unilateral movements are counted correctly in your volume totals.
`,
  },
  {
    version: 2621,
    message: msg`
🕐 New: Workout Duration Estimate!

Each workout card now shows an estimated duration so you can plan your sessions at a glance before you start.
`,
  },
  {
    version: 2622,
    message: msg`
🔔 New: Exercise Timer Sounds!

The exercise timer now plays audio cues to keep you on track. A countdown beep as the timer nears zero and a sound when you hit your goal. Toggle each sound independently in Settings.
`,
  },
  {
    version: 2623,
    message: msg`
📋 New: "More" Menu and Help & Info Section!

There's a new "More" tab in the navigation bar. Tap it to open a slide-in panel where you'll find Settings and a brand new Help & Info section.

Settings has moved here from the tab bar, and Help & Info covers everything from plans and workouts to stats and your account, with a search bar to find answers quickly.
`,
  },
  {
    version: 2624,
    message: msg`
💾 New: Save & Resume Plan and Workout Drafts!

Your work in the plan and standalone workout editors is now automatically saved as a draft. If you leave mid-edit, you'll be prompted to continue where you left off or discard the draft, so you never lose progress by accident.
`,
  },
  {
    version: 2625,
    message: msg`
🔥 Improved: Warm-Up Set Management!

Warm-up sets are visually grouped and styled separately from working sets, and "Apply to all" lets you bulk-edit warm-up or working sets independently.
`,
  },
  {
    version: 2626,
    message: msg`
🗂️ New: Five New Premade Training Plans!

Five new ready-to-use plans are now available: 5-Day Bro Split, 5-Day Push/Pull/Legs, 6-Day Split, Bodyweight, and Dumbbell Only. Whether you're training at home or in the gym, there's a plan to get you started straight away.
`,
  },
  {
    version: 2627,
    message: msg`
📅 New: Workout Calendar!

Tap the calendar icon in the Workout History section on the Stats tab to browse your training history by date. Days with workouts are highlighted, and tapping any day shows the sessions logged on that date.
`,
  },
  {
    version: 2628,
    message: msg`
🔍 Improved: Smarter Exercise Search & Easy Access to the Exercise Library!

Exercise search now understands common abbreviations like RDL, OHP, DB, and KB, corrects minor typos, and ranks results by relevance so the best match always comes first.

You can also browse the full exercise library any time from the menu, without needing to be in a workout or plan.
`,
  },
  {
    version: 2629,
    message: msg`
📋 Improved: Smarter History Pre-Fill During Workouts!

Set fields now pre-fill more intelligently. If an exercise has no history in the current workout, it falls back to the most recent time you performed it in any session, so you always start with a useful reference.

A new setting in the Workout section lets you always use the most recent history across all workouts, regardless of which routine it came from.
`,
  },
  {
    version: 2630,
    message: msg`
📏 New: Body Measurements!

Track your body composition alongside your training from the new Measurements section in the Stats tab.

• Log weight, body fat %, waist, hips, chest, and more
• Tap any past entry to edit values or view a chart of that metric over time
• Manage which metrics appear and add your own custom metrics
• Units follow your weight and size preferences in Settings
`,
  },
  {
    version: 2631,
    message: msg`
🔃 New: Sort the Exercise Library!

The exercise library now has sort chips so you can find exercises faster. Sort by Default, Active Plan, Recent, or Frequent to see the exercises most relevant to you at the top.
`,
  },
  {
    version: 2632,
    message: msg`
⚖️ New: Track Weight for Bodyweight Exercises!

For bodyweight exercises like pull-ups or dips, you can now toggle on weight tracking per workout. Perfect for weighted variations, so you can log the added weight and track progression over time.
`,
  },
  {
    version: 2633,
    message: msg`
🗂️ New: Plan View Options!

The Plans screen now has three display modes. Use the icons next to the "Your Training Plans" heading to switch between Carousel, List, and Grid view. Your preferred layout is saved automatically.
`,
  },
  {
    version: 2634,
    message: msg`
📈 Beta: Adaptive Progression!

MuscleQuest can now suggest when to increase your weight or reps based on how your sessions feel. After each exercise, answer two quick questions about effort and pain. Once you have reported the same signal for two sessions in a row, the app suggests a change. All suggestions appear in the Workout Summary screen, where you can accept or dismiss each one individually. Accepted suggestions are pre-filled into your next session automatically.

A Recovery Check-in at the start of your next workout lets you factor in soreness before any suggestion is applied. You can also mark a full week as a Deload from the plan overview, which pauses feedback and progression tracking for that week.

Enable it in Settings under Adaptive Progression, and configure your preferred load increment per equipment category.
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
