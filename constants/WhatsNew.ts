import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

export interface WhatsNewEntry {
  version: number;
  // Key into RELEASES: the app version whose users first got this change,
  // whether through a store build or an OTA update on that runtime. A new
  // entry takes the version app.config.js currently has.
  release: string;
  message: MessageDescriptor;
}

export interface Release {
  version: string;
  // YYYY-MM the release first reached users
  date: string;
}

// Oldest first. The changelog screen shows them newest first and hides any
// release that has no entries yet.
export const RELEASES: Release[] = [
  { version: "0.8", date: "2024-11" },
  { version: "0.9", date: "2025-02" },
  { version: "0.10", date: "2025-02" },
  { version: "0.12", date: "2025-02" },
  { version: "0.14", date: "2025-03" },
  { version: "0.16", date: "2025-03" },
  { version: "0.17", date: "2025-11" },
  { version: "0.20", date: "2026-05" },
  { version: "0.21", date: "2026-05" },
  { version: "1.0", date: "2026-05" },
  { version: "1.3", date: "2026-06" },
  { version: "1.4", date: "2026-07" },
  { version: "1.5", date: "2026-10" },
];

// Entries below 2601 are changelog history and never pop up in
// WhatsNewModal: every stored lastSeenVersion is already above them.
export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    version: 801,
    release: "0.8",
    message: msg`
🚀 MuscleQuest Is Here!

The first public release. Build your own training plans or start from a premade one, then log weight, reps, or time for every set as you train. A rest timer counts down between sets and alerts you with a sound and vibration when it's done.

The home screen tracks your weekly goal, Stats shows your workout history and a progression chart for every exercise, and you can edit any completed workout. Everything is stored on your phone, so the app works offline.
`,
  },
  {
    version: 802,
    release: "0.8",
    message: msg`
☁️ New: Backup & Restore!

Sign in to back up your training data to the cloud and restore it on a new phone, so a lost or replaced device no longer means losing your history.

Also new in this release: a short introduction for first-time users, a 4-Day Upper/Lower Split premade plan, more bodyweight exercises, replacing an exercise in the plan editor, and an "Active" badge on your current plan.
`,
  },
  {
    version: 803,
    release: "0.8",
    message: msg`
🔔 New: Rest Timer Notifications!

The rest timer now sends a notification when your rest is over, so you don't miss your next set while you're in another app. You can switch it off in Settings.
`,
  },
  {
    version: 901,
    release: "0.9",
    message: msg`
📋 New: Pre-Filled Sets!

Weight and reps are now pre-filled from the last time you did the workout, so you can see what to beat without looking it up.

You can also give your plans a picture from a built-in gallery or from your own photos.
`,
  },
  {
    version: 1001,
    release: "0.10",
    message: msg`
⚙️ New: More in Settings!

You can now replay the app introduction, request a feature, and find MuscleQuest on Instagram, all from Settings.
`,
  },
  {
    version: 1201,
    release: "0.12",
    message: msg`
↕️ Improved: Smoother Plan Editing!

Dragging exercises to reorder them in the plan editor is smoother and more reliable, and a newly added workout scrolls into view straight away. Loading indicators now show while workouts start, save, and open, so you always know the app is working.
`,
  },
  {
    version: 1300,
    release: "0.14",
    message: msg`
📝 New Feature: Notes!

You can now add notes to exercises, workouts and plans. Use this to jot down technique tips, machine settings, reminders, or anything else that helps you crush your session!
`,
  },
  {
    version: 1600,
    release: "0.16",
    message: msg`
🔥 New Feature: To Failure Sets!

You can now mark a set "to failure", instead of adding a rep range, which is especially useful for isolation machine, dumbbell, or bodyweight exercises, when you want to push yourself to the limit.
`,
  },
  {
    version: 2601,
    release: "0.17",
    message: msg`
🎯 Improved: Smarter Exercise Filters!

When replacing an exercise, the filter now automatically preselects the target muscle to match what you're replacing. Only relevant filters are shown based on your current selection, making it much faster to find the right alternative.
`,
  },
  {
    version: 2602,
    release: "0.17",
    message: msg`
🐛 Fixed: Workout Session Buttons & Edit Set Modal!

Fixed a bug where all buttons (increment/decrement, next/previous set, complete set) would stop working after completing a set. Also fixed an error in the edit set modal. Set transitions now happen instantly for a smoother workout flow.
`,
  },
  {
    version: 2603,
    release: "0.17",
    message: msg`
🔔 New: In-App Update Notifications!

A new update modal now appears when an over-the-air update is available, so you always know when improvements have been downloaded and are ready to apply.
`,
  },
  {
    version: 2604,
    release: "0.20",
    message: msg`
📋 New: View Workout Details from the Home Screen!

You can now tap any recent workout on the home screen to view its full details. Each workout and set overview also has a new details button for quick access to exercise information.
`,
  },
  {
    version: 2605,
    release: "0.20",
    message: msg`
↕️ New: Reorder Workouts in Your Plan!

You can now reorder workouts directly in the plan creation screen and workout cards, giving you full control over your training schedule layout.
`,
  },
  {
    version: 2606,
    release: "0.20",
    message: msg`
🐛 Fixed: Various Bug Fixes & Improvements!

Fixed the rest timer notification not triggering correctly, exercise name wrapping in the workout session, the workout completion circle width, notes not updating correctly while typing, and workout details sometimes opening in the wrong tab. Workouts now load faster thanks to internal performance improvements.
`,
  },
  {
    version: 2607,
    release: "0.20",
    message: msg`
🏋️ New: Single Workouts & Quick Workouts!

Create standalone workouts outside of your training plans — perfect for flexible training sessions, mobility work, or anything ad hoc. Find them on the Plans screen.

Or start a Quick Workout from the home screen, add exercises on the fly, and optionally save it as a standalone workout when you're done.
`,
  },
  {
    version: 2608,
    release: "0.20",
    message: msg`
📅 New: Weekly Schedule for Your Plan!

You can now assign workouts to specific days of the week directly in the plan editor. Tap any day to pick a workout or mark it as a rest day. Use the auto-suggest button to instantly generate a balanced schedule based on your weekly goal.
`,
  },
  {
    version: 2609,
    release: "0.21",
    message: msg`
🔗 New: Supersets!

Pair two exercises together as a superset directly in the plan editor. Sets are kept in sync between both exercises, and supersets are clearly grouped with a visual indicator throughout the app.
`,
  },
  {
    version: 2610,
    release: "0.21",
    message: msg`
✨ New: Workout Session Animations!

Navigating between sets now features smooth slide transitions. Swipe left or right to move between sets, or use the pre-existing arrow buttons for the same effect.
`,
  },
  {
    version: 2611,
    release: "0.21",
    message: msg`
📊 New: Workout Summary!

After completing a workout, you'll now see a full summary of your session: total duration, sets, and volume, plus a comparison against your previous session. Tap any exercise to expand its individual sets and weights.
`,
  },
  {
    version: 2612,
    release: "0.21",
    message: msg`
⏱️ New: Adjustable Rest Timer!

A new slide-in panel lets you fine-tune your rest duration on the fly during a workout. Your custom rest time is saved per set, so each set remembers exactly how long you like to rest.
`,
  },
  {
    version: 2613,
    release: "0.21",
    message: msg`
🔵 New: Exercise Timer Modal!

Time-based exercises now show a dedicated countdown modal with a progress ring, making it easy to track your effort and stay on pace during timed sets.
`,
  },
  {
    version: 2614,
    release: "0.21",
    message: msg`
↕️ New: Reorder Exercises in the Workout Overview!

You can now drag and drop exercises and supersets to reorder them directly from the workout overview screen during a session.
`,
  },
  {
    version: 2615,
    release: "0.21",
    message: msg`
💾 New: Save Workout Changes Back to Your Plan!

When you finish a session where you added, removed, or reordered exercises, or sets, you'll be prompted to save those changes back to the original plan or standalone workout, keeping your training up to date automatically.
`,
  },
  {
    version: 2616,
    release: "0.21",
    message: msg`
📊 New: Improved Stats Screen!

The stats screen has been redesigned with a fresh new look and improved insights. Explore your training history with better charts, clearer summaries, and more detailed breakdowns of your progress over time.
`,
  },
  {
    version: 2617,
    release: "0.21",
    message: msg`
📏 New: Distance Tracking for Custom Exercises!

Custom exercises can now use a distance tracking type, perfect for cardio and conditioning movements like runs, rows, or sled pushes. Log distance for your sets and get insights on progression just like any other exercise.
`,
  },
  {
    version: 2618,
    release: "0.21",
    message: msg`
🔔 New: Workout Reminder Notifications!

Never miss a session. Set reminder notifications for your workouts directly from the app. Choose which days you want to be reminded, and pick a time to get started.
`,
  },
  {
    version: 2619,
    release: "0.21",
    message: msg`
📈 New: Exercise History in the Info Screen!

The exercise info screen now includes a full history of every time you've performed that exercise, showing weights, reps, time, and distance for each set from past sessions. Access it during a workout, from your plan, or anywhere else exercise info is available.
`,
  },
  {
    version: 2620,
    release: "0.21",
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
    release: "0.21",
    message: msg`
🕐 New: Workout Duration Estimate!

Each workout card now shows an estimated duration so you can plan your sessions at a glance before you start.
`,
  },
  {
    version: 2622,
    release: "0.21",
    message: msg`
🔔 New: Exercise Timer Sounds!

The exercise timer now plays audio cues to keep you on track. A countdown beep as the timer nears zero and a sound when you hit your goal. Toggle each sound independently in Settings.
`,
  },
  {
    version: 2623,
    release: "0.21",
    message: msg`
📋 New: "More" Menu and Help & Info Section!

There's a new "More" tab in the navigation bar. Tap it to open a slide-in panel where you'll find Settings and a brand new Help & Info section.

Settings has moved here from the tab bar, and Help & Info covers everything from plans and workouts to stats and your account, with a search bar to find answers quickly.
`,
  },
  {
    version: 2624,
    release: "0.21",
    message: msg`
💾 New: Save & Resume Plan and Workout Drafts!

Your work in the plan and standalone workout editors is now automatically saved as a draft. If you leave mid-edit, you'll be prompted to continue where you left off or discard the draft, so you never lose progress by accident.
`,
  },
  {
    version: 2625,
    release: "0.21",
    message: msg`
🔥 Improved: Warm-Up Set Management!

Warm-up sets are visually grouped and styled separately from working sets, and "Apply to all" lets you bulk-edit warm-up or working sets independently.
`,
  },
  {
    version: 2626,
    release: "0.21",
    message: msg`
🗂️ New: Five New Premade Training Plans!

Five new ready-to-use plans are now available: 5-Day Bro Split, 5-Day Push/Pull/Legs, 6-Day Split, Bodyweight, and Dumbbell Only. Whether you're training at home or in the gym, there's a plan to get you started straight away.
`,
  },
  {
    version: 2627,
    release: "0.21",
    message: msg`
📅 New: Workout Calendar!

Tap the calendar icon in the Workout History section on the Stats tab to browse your training history by date. Days with workouts are highlighted, and tapping any day shows the sessions logged on that date.
`,
  },
  {
    version: 2628,
    release: "1.0",
    message: msg`
🔍 Improved: Smarter Exercise Search & Easy Access to the Exercise Library!

Exercise search now understands common abbreviations like RDL, OHP, DB, and KB, corrects minor typos, and ranks results by relevance so the best match always comes first.

You can also browse the full exercise library any time from the menu, without needing to be in a workout or plan.
`,
  },
  {
    version: 2629,
    release: "1.0",
    message: msg`
📋 Improved: Smarter History Pre-Fill During Workouts!

Set fields now pre-fill more intelligently. If an exercise has no history in the current workout, it falls back to the most recent time you performed it in any session, so you always start with a useful reference.

A new setting in the Workout section lets you always use the most recent history across all workouts, regardless of which routine it came from.
`,
  },
  {
    version: 2630,
    release: "1.0",
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
    release: "1.0",
    message: msg`
🔃 New: Sort the Exercise Library!

The exercise library now has sort chips so you can find exercises faster. Sort by Default, Active Plan, Recent, or Frequent to see the exercises most relevant to you at the top.
`,
  },
  {
    version: 2632,
    release: "1.0",
    message: msg`
⚖️ New: Track Weight for Bodyweight Exercises!

For bodyweight exercises like pull-ups or dips, you can now toggle on weight tracking per workout. Perfect for weighted variations, so you can log the added weight and track progression over time.
`,
  },
  {
    version: 2633,
    release: "1.0",
    message: msg`
🗂️ New: Plan View Options!

The Plans screen now has three display modes. Use the icons next to the "Your Training Plans" heading to switch between Carousel, List, and Grid view. Your preferred layout is saved automatically.
`,
  },
  {
    version: 2634,
    release: "1.0",
    message: msg`
📈 Beta: Adaptive Progression!

MuscleQuest can now suggest when to increase your weight or reps based on how your sessions feel. After each exercise, answer two quick questions about effort and pain. Once you have reported the same signal for two sessions in a row, the app suggests a change. All suggestions appear in the Workout Summary screen, where you can accept or dismiss each one individually. Accepted suggestions are pre-filled into your next session automatically.

A Recovery Check-in at the start of your next workout lets you factor in soreness before any suggestion is applied. You can also mark a full week as a Deload from the plan overview, which pauses feedback and progression tracking for that week.

Enable it in Settings under Adaptive Progression, and configure your preferred load increment per equipment category.
`,
  },
  {
    version: 2635,
    release: "1.3",
    message: msg`
👥 New: Friends & Social Sharing!

Add friends by searching for their username from the Friends tab in the menu. Send a request, and once accepted you can browse each other's shared content. A badge on the Friends menu item shows pending incoming requests.

Share your plans, standalone workouts, custom exercises, body measurements, and strength PRs by toggling Share in the relevant screen or from Privacy Settings in the Account section of Settings. Shared content syncs automatically whenever it changes, and a cloud icon on plan and workout cards shows what is currently published. You can delete all shared data for any category from Privacy Settings at any time.

Tap any accepted friend's name to open their profile and import their plans, standalone workouts, or custom exercises directly into your own library.
`,
  },
  {
    version: 2636,
    release: "1.3",
    message: msg`
📋 New: Duplicate a Plan!

You can now duplicate any of your training plans directly from the plan overview screen. A full copy is created instantly with all workouts and exercises, ready for you to rename and customise.
`,
  },
  {
    version: 2637,
    release: "1.3",
    message: msg`
🔃 Improved: Drop Set Flow!

Adding a drop set during a session now appends a brand new set rather than flagging the current one, giving you full control over your drop set structure. The new set is pre-filled with weight and 10 second rest time automatically.
`,
  },
  {
    version: 2638,
    release: "1.3",
    message: msg`
🏋️ New: Choose Workout from the Home Screen!

Tap the new "Choose Workout" button next to Quick Workout to search and browse every workout across your plans and standalone library, then start any one of them instantly.
`,
  },
  {
    version: 2639,
    release: "1.3",
    message: msg`
📉 New: Layoff-Aware Weight Suggestions!

Haven't trained a muscle group in 2 or more weeks? Adaptive Progression now suggests a lighter starting weight to help you ease back in safely, scaling the reduction from 10% to 20% the longer you've been away. It respects a manually flagged Deload Week, so the two never stack.

We also fixed a batch of Adaptive Progression bugs: rep-increase suggestions now show up properly instead of only weight ones, the Recovery Check-in appears reliably even if you close the app mid-workout, and feedback prompts no longer repeat during drop sets.
`,
  },
  {
    version: 2640,
    release: "1.3",
    message: msg`
🔃 New: Reorder Tracked Exercises!

You can now drag and drop to reorder the exercises you're tracking on the Stats screen, so your most important ones stay right where you want them.
`,
  },
  {
    version: 2641,
    release: "1.4",
    message: msg`
📋 New: Copy a Workout to Your Standalone Library!

Any workout in a plan can now be copied straight to your standalone workout library in one tap, from the plan or workout details screen, so you can run it independently whenever you like.
`,
  },
  {
    version: 2642,
    release: "1.4",
    message: msg`
✏️ New: Fix a Logged Exercise!

Made a mistake in a completed workout? Tap the pencil icon next to any exercise on the edit-history screen to swap it for the correct one, filtered to match its tracking type.
`,
  },
  {
    version: 2643,
    release: "1.4",
    message: msg`
🐛 Fixed: Cloud Backup Errors!

Backup would silently fail after a clean shutdown because it required extra database files that aren't always present. Backups now work correctly in that case, and any real backup failure now shows an on-screen error instead of failing silently.
`,
  },
  {
    version: 2644,
    release: "1.4",
    message: msg`
📖 Improved: Redesigned Help Screen!

The Help & Info screen now opens with collapsed, expandable topic groups and a chip row to jump straight to a section. Search is faster and smarter, highlighting the exact matching text in each result, and shows a helpful empty state with a link to request a feature if nothing matches.
`,
  },
  {
    version: 2645,
    release: "1.4",
    message: msg`
🔍 Improved: More Accurate Exercise Search!

Exercise search has been rebuilt on a more robust matching engine, improving how typos, abbreviations, and multi-word queries get matched and ranked, so the exercise you're looking for shows up first more often.
`,
  },
  {
    version: 2646,
    release: "1.4",
    message: msg`
👀 Improved: Preview Before You Start!

In the Choose Workout list, tapping a workout now opens its details so you can check the exercises first. Use the Start button on the right to jump straight into the session. Plan workouts also gained a Start button on their details screen.
`,
  },
  {
    version: 2647,
    release: "1.4",
    message: msg`
⚙️ Improved: More Control During Your Workout!

You can now change an exercise's rep range and rest time mid-workout from the three-dot menu. If you enter a weight other than the suggested one, it now carries over to your remaining sets. Weight suggestions also stay hidden when adaptive progression is switched off.
`,
  },
  {
    version: 2648,
    release: "1.4",
    message: msg`
🏋️ New: Plate Calculator!

Open the three-dot menu during a workout and tap Plate Calculator to see exactly which plates to load on each side of the bar. Pick your bar weight once and it is remembered. Under Settings > Workout > Plates you can tell the app which plates you actually own, so it never suggests a load you cannot build.
`,
  },
  {
    version: 2649,
    release: "1.4",
    message: msg`
🐛 Fixed: Weight Suggestions in Pounds!

If you train in pounds, adaptive progression suggestions now use your weight unit correctly. Previously some suggestions came out too small or were filled in with the wrong value.
`,
  },
  {
    version: 2650,
    release: "1.4",
    message: msg`
☁️ Improved: Safer Backups & Restores!

A backup that fails partway can no longer overwrite your last good one, and every backup is checked before it is uploaded. Restoring a backup made with an older version of the app now works reliably, and the restore prompt tells you exactly what will be replaced.
`,
  },
  {
    version: 2651,
    release: "1.4",
    message: msg`
📤 New: Export Your Data & Delete Your Account!

Under Settings > Your data you can now export your workouts and body measurements as CSV for spreadsheets, or as JSON with everything including plans and custom exercises. If you are signed in, you can also delete your account there, which removes everything stored online. You choose whether to keep your training history on this device.
`,
  },
  {
    version: 2652,
    release: "1.4",
    message: msg`
📏 New: Log Measurements from the Home Screen!

A new card on the home screen shows your most recent measurement and how long ago you logged it. Tap it to record today's numbers in a quick sheet, pre-filled with your most recent values, without leaving the screen.

The card highlights itself once it has been a week since your last entry, and follows whichever metrics you have switched on in the Measurements section.
`,
  },
  {
    version: 2653,
    release: "1.4",
    message: msg`
⏱️ Improved: Rest Timer Alerts When Your Phone Is Locked!

The rest timer now always sends a notification when your rest is over, even if your phone is locked or you switched to another app. The first time you start a rest, MuscleQuest asks for permission to send it.

The notification setting now only decides whether that alert also shows while the app is open. You'll find it in Settings as "Show rest notification while app is open".
`,
  },
  {
    version: 2654,
    release: "1.4",
    message: msg`
↩️ New: Undo Instead of "Are You Sure?"

Deleting a completed workout, a standalone workout, a body measurement, or an exercise or set during a session now happens straight away, with an Undo button at the bottom of the screen for a few seconds. Plans still ask before deleting, and can be undone too.

The app is also clearer when you're offline: Friends shows a banner, and backup, restore, and sign-in tell you why they're unavailable. Pull down on Stats, Friends, or a friend's profile to refresh. Leaving the workout overview mid-session now asks you to confirm first, so you can't leave by accident.
`,
  },
  {
    version: 2655,
    release: "1.4",
    message: msg`
🐛 Fixed: Dates, Pounds & Speed!

• Workout times now show the correct clock time, and late-evening workouts count toward the right day for streaks, the calendar, and weekly goals.
• If you train in pounds, repeating the same weight no longer creates a false PR or shows "+0.0 lbs", and body weight entered in pounds reads back exactly as you typed it.
• History and stats load faster, especially if you have a long training history.
`,
  },
  {
    version: 2656,
    release: "1.4",
    message: msg`
♿ Improved: Screen Readers, Large Text & Reduced Motion!

MuscleQuest now works properly with TalkBack and VoiceOver. Buttons and fields are labelled, finishing a set and the rest countdown are announced, and every chart has a spoken summary. On an exercise's chart you can tap Show as table to read the numbers instead.

Text and buttons now grow with your system font size, and animations are switched off when your device is set to reduce motion.
`,
  },
  {
    version: 2657,
    release: "1.4",
    message: msg`
⚡ Improved: Faster Lists & Tidier Friend Profiles!

The exercise library, home screen and stats open faster, especially with a long training history. The sections on a friend's profile now start collapsed, so a long profile is easier to scan; tap a heading to open it.
`,
  },
  {
    version: 2658,
    release: "1.4",
    message: msg`
☁️ New: Backup Reminders!

Your training history lives on your phone, so a backup is the only way to get it back if you lose or replace it. The home screen now reminds you when you have never backed up, or when your last backup is more than 30 days old, and you can back up right from the card.

Not signed in? After a few workouts the card offers to sign you in instead. Tap Later to hide it for two weeks.
`,
  },
  {
    version: 2659,
    release: "1.4",
    message: msg`
⏸️ New: Pick Up Where You Left Off!

If you come back to an unfinished workout after more than four hours, MuscleQuest now asks whether to resume it or discard it, or, once you have completed at least one set, to finish and save it. A workout finished this way records its duration up to your last logged set, instead of counting the hours in between.

Also in this update:
• Correcting or deleting your latest session now updates the progression suggestion built on it, so a typo no longer carries into your next workout.
• Sign-in problems now tell you what went wrong, such as being offline or missing Google Play Services, in your own language.
`,
  },
  {
    version: 2660,
    release: "1.4",
    message: msg`
✅ Fixed: Logged Values Are Right!

Number fields now use your phone's decimal separator. Typing 62,5 logs 62.5, not 625. If a weight looks far heavier than your recent sets, MuscleQuest asks before saving it and offers the likely intended value.

Also in this update:
• Weight and distance units are locked while a workout is in progress, so values you have entered are not reinterpreted.
• Editing a past workout now saves only the sets you changed.
• Distance targets in your plans are now stored in metres, so changing units no longer changes them. If you use feet and had an unsaved plan draft open during this update, check its distance targets before saving. Friends on an older version see your shared distance targets in metres until they update.
`,
  },
  {
    version: 2661,
    release: "1.5",
    message: msg`
📜 New: Changelog!

Missed a What's New message, or want to see how MuscleQuest has grown? Open the menu and tap Changelog, below Help & Info, to browse every update by release, all the way back to the first version.
`,
  },
  {
    version: 2662,
    release: "1.5",
    message: msg`
📊 New: Make Stats Your Own!

Tap the pencil on the Stats screen to show, hide and reorder every section, and the gear beside a section to change what it shows. Trend charts can plot workouts, volume, sets, reps or training time, and any section can keep its own time range.

Also new on Stats:
• Sets per Muscle / Week: your weekly working sets for each muscle, against a target range you choose.
• Recent PRs: every new personal record, with what it beat.
• Consistency: a calendar grid of your training days.
`,
  },
  {
    version: 2663,
    release: "1.5",
    message: msg`
🔁 New: Last Time on Every Set!

Each set now shows what you did last time, such as "Last time: 60 kg × 8 (12 Sep)", just above Complete Set. Tap it to fill in those values. When a progression suggestion has set the weight, you see both, so you know where the number came from.

Also in this update:
• Tap Skip on the rest timer to end your rest early.
• Finishing with sets left undone now asks first and tells you which ones won't be saved.
`,
  },
  {
    version: 2664,
    release: "1.5",
    message: msg`
🏆 New: PRs as They Happen!

Beat your best on an exercise and the set gets a PR badge and a short buzz, right as you log it. The workout summary lists every new personal record with what it beat.

The confetti is now saved for the moments that count: a new PR, or the workout that reaches your weekly goal.
`,
  },
  {
    version: 2665,
    release: "1.5",
    message: msg`
👥 Improved: Sharing Keeps Up With Your Changes!

Deleting or editing a workout, measurement, plan or workout you've shared now updates what your friends see. A friend's profile shows their latest workouts and their full workout count.

If someone signs in to a different account on your phone, backups and sharing now pause, and MuscleQuest asks whether to use your training data with that account.
`,
  },
  {
    version: 2666,
    release: "1.5",
    message: msg`
🐛 Fixed: Suggestions, Saves & Restores!

• Progression suggestions now start from your latest session, not your heaviest ever, so a deleted or deload session no longer pushes them too high.
• Finishing an old workout with "Finish and save" records it on the day you trained.
• If the app closes right after you finish a workout, reopening it shows the summary instead of saving the workout twice.
• Going back to an exercise opens its first unfinished set.
• Restoring a backup warns you if a workout is in progress, and a restore that fails to open can be undone.
• The app opens faster, numbers everywhere use your phone's decimal separator, and workout reminders appear in your language.
• Crash reports no longer include your email address or name.
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
