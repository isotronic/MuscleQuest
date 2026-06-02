import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

export type SectionData = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: MessageDescriptor;
  body: MessageDescriptor;
};

export type GroupData = {
  group: MessageDescriptor;
  sections: SectionData[];
};

export const HELP_DATA: GroupData[] = [
  {
    group: msg`Training`,
    sections: [
      {
        icon: "home-outline",
        title: msg`Home Screen & Weekly Goal`,
        body: msg`The home screen shows your progress toward your weekly training goal, which is the number of days you want to work out each week, set in Settings. A strip at the top tracks how many days you have completed and highlights each completed day. Below it, your active plan's workouts are listed with their completion status for the week; tap Start on any workout to begin. The card displayed beneath changes with your status: a Resume card appears if a session is in progress, a Rest Day card shows on days with no scheduled workout, and a Workout Done card confirms today's session is complete. When you hit your weekly goal, a Weekly Summary card appears showing total workouts, sets, and volume for the week, plus your streak, which counts the number of consecutive weeks you have met your goal.`,
      },
      {
        icon: "calendar-outline",
        title: msg`Plans`,
        body: msg`Plans are structured training programmes made up of workouts. To create one, go to the Plans tab, tap New Plan, give it a name, and pick a cover image. Add workouts to the plan, then add exercises to each workout with target sets and reps. Use the up/down arrow buttons on a workout card to reorder it, or the X button to remove it; both are in the top right of the card. Assign workouts to specific days of the week in the schedule editor: tap any day to pick a workout or leave it as a rest day, and use the auto-suggest button to space them out evenly. Once your plan is ready, open it and tap Activate. You can also add notes to a plan from the plan overview screen. Each workout card shows an estimated duration alongside the exercise count so you can gauge the session length at a glance. Use the view icons next to the "Your Training Plans" heading to switch between Carousel, List, and Grid layouts; your chosen view is saved automatically. Your progress in the plan editor is automatically saved as a draft, so if you leave mid-edit you will be prompted to continue where you left off or discard and start from the last saved state.`,
      },
      {
        icon: "library-outline",
        title: msg`Premade Plans`,
        body: msg`The Plans tab includes a library of ready-made training programmes you can start immediately. Scroll past Your Training Plans to find the Premade Plans section. Tap any programme to preview its workouts and schedule, then tap Activate to make it your active plan. You can edit a premade plan to adjust exercises, sets, or the weekly schedule. This will create a copy of the premade plan that you can modify without affecting the original, so you can always return to the default version if needed.`,
      },
      {
        icon: "barbell-outline",
        title: msg`Workouts`,
        body: msg`Standalone workouts live outside of plans and appear alongside your plans on the Plans screen. Create one by tapping New Workout, give it a name, and add exercises; you can run it at any time without needing an active plan. An estimated duration is shown on each standalone workout so you can plan your time before starting. Quick Workouts let you start a session immediately from the home screen: tap Quick Workout, add exercises as you go, and at the end you can save it as a standalone workout for future use or simply discard it. Like plans, the workout editor automatically saves a draft so you can safely leave and return without losing your work.`,
      },
      {
        icon: "play-circle-outline",
        title: msg`Active Workout`,
        body: msg`During a session, swipe left/right or use the arrow buttons to move between sets. Enter your weight and reps, then tap Complete Set. The total elapsed time is shown in the header throughout. You can drag the handle on any exercise card to reorder exercises while the session is in progress. Time-based exercises have a Start Timer button that opens a count-up timer with a progress ring that shows you when you hit your goal time but you can keep going as long as you like. Notes can be added per-exercise via the notes icon in the exercise header, per workout from the workout overview screen, or per plan from the plan overview screen. If you add, remove, or reorder exercises or sets during a session, you will be prompted at the end to save those changes back to the original workout or plan.`,
      },
      {
        icon: "trophy-outline",
        title: msg`Workout Summary`,
        body: msg`After finishing a workout, a summary screen shows your total duration, sets completed, and total volume. If you have done the same workout before, a comparison row shows how each metric compares to the previous session. A weekly goal banner shows how many sessions you have logged this week against your goal. Tap any exercise in the list to expand it and review every set in detail. When completing a Quick Workout, you will be prompted to save it as a standalone workout for future use or discard it.`,
      },
      {
        icon: "timer-outline",
        title: msg`Rest Timer`,
        body: msg`The rest timer starts automatically after each set and counts down to zero. Each set remembers its own rest duration, so different sets within the same exercise can have different rest periods. Use the ± buttons to adjust the remaining time on the fly during rest. Configure the default rest duration, the timer increment, and whether a sound, vibration, or background notification fires at the end; each option is independently toggleable in Settings.`,
      },
      {
        icon: "git-merge-outline",
        title: msg`Supersets`,
        body: msg`Group two exercises into a superset so they alternate automatically during a session, ideal for pairing antagonist muscles or staying efficient between sets. Tap the three-dot menu on any exercise in the workout editor and choose Create Superset, then select the second exercise. A coloured label identifies which superset each exercise belongs to throughout the app. When you complete a set on one exercise, the app moves you straight to its superset partner.`,
      },
    ],
  },
  {
    group: msg`Adaptive Progression`,
    sections: [
      {
        icon: "trending-up-outline",
        title: msg`Overview`,
        body: msg`Adaptive Progression analyses your effort feedback over consecutive sessions and suggests when to increase your weight, reps, or sets. Enable it in Settings under Adaptive Progression. Once on, a short feedback prompt appears after each exercise in plan-based workouts. The engine requires two sessions with the same signal before recommending an upward change, filtering out one-off easy days and ensuring consistent performance before suggesting an increase. Pain or failed sets act immediately regardless of your session history. A suggestion is never applied to your workout without your explicit approval. You can also configure your preferred load increment per equipment category in the same section of Settings, for example 2.5 kg for barbell exercises and 2.0 kg for dumbbells.`,
      },
      {
        icon: "chatbox-ellipses-outline",
        title: msg`Post-Exercise Feedback`,
        body: msg`After completing the last working set of an exercise, a feedback sheet slides up with two questions. The first asks how the effort felt: Easy (you could have done more), About right, Hard (near your limit), or Couldn't finish all sets. The second asks about pain: No pain, Minor discomfort, or Pain or form issues. If you answer Easy, a third question appears asking whether you want to push harder next time. This lets you deliberately hold the current load even when a session felt light, so the engine respects your intent. If you answer Pain, an optional text field lets you note where you felt it for your own reference. The sheet can be dismissed without answering if you prefer not to log feedback for that exercise in that session.`,
      },
      {
        icon: "checkbox-outline",
        title: msg`Progression Suggestions`,
        body: msg`After finishing a workout, the Workout Summary screen shows a Next Session card listing actionable suggestions for your exercises. Each row shows the exercise name, the proposed change (a new target weight, a wider rep range, or a note to reduce load), and a short explanation of why the change is being suggested. Tap Accept to apply the suggestion to that exercise for your next session, or Dismiss to ignore it. Accepted suggestions are pre-filled into the weight and rep fields the next time you open that workout, so you start the session already targeting the right load. The Accept All button at the top applies every suggestion at once. Suggestions that recommend holding the current load do not appear in the card, as no action is needed for those.`,
      },
      {
        icon: "heart-circle-outline",
        title: msg`Recovery Check-in`,
        body: msg`When you open a workout that contains exercises you trained recently, a Recovery Check-in sheet appears if those exercises have a pending progression suggestion and your last session was at least 12 hours ago. For each relevant muscle group, you choose one of three options: Fresh (fully recovered), Mild soreness, or Still very sore. If a muscle is marked as still very sore, any upward progression suggestion for exercises targeting that muscle is paused and held at the current load until you re-evaluate at the start of the following session. Fresh or Mild soreness does not affect suggestions. Tap Skip for now to bypass the check-in entirely; a skipped check-in is treated the same as fresh recovery, so pending suggestions are unaffected.`,
      },
      {
        icon: "calendar-clear-outline",
        title: msg`Deload Week`,
        body: msg`A deload is a planned recovery week where you train at reduced intensity to let your body fully recover before the next training block. Tap Mark as Deload Week on the plan overview screen to flag the current week as a deload. While the deload is active, the post-exercise feedback sheet does not appear and no new progression states are created or updated, so your suggestion history is not disrupted by the lighter sessions. The deload resets automatically at the start of the following week, and normal feedback and progression tracking resume without any manual action. If you change your mind, tapping the button again while the deload is active will clear it.`,
      },
    ],
  },
  {
    group: msg`Sets & Exercises`,
    sections: [
      {
        icon: "options-outline",
        title: msg`Set Types`,
        body: msg`Each set can be flagged as a Warm-up, Drop Set, To Failure, or any combination of these. The badge shown next to a set displays its current type. To change the type during a session, tap the menu (⋮) and toggle the relevant option on or off. When building a plan, use the checkboxes in the set editor; tap Add Warm-up to insert a dedicated warm-up set at the top of the list. Warm-up sets are visually grouped and separated from working sets, and the Apply to All option in the edit modal only affects sets of the same type. Warm-up sets can be excluded from volume and stats calculations in Settings.`,
      },
      {
        icon: "search-outline",
        title: msg`Exercise Library`,
        body: msg`Browse almost 1,000 exercises and filter by body part, target muscle, or equipment. Use the sort chips at the top to order exercises by Default, Active Plan, Recent, or Frequent, so the exercises most relevant to you appear first. When replacing an exercise, the filter automatically preselects the matching target muscle to help you find alternatives faster. Tap any exercise to view its animated demonstration, the muscles targeted, and a full history of every time you have performed it, including weights, reps, time, or distance per set. Download all exercise animations (~100 MB) in Settings for offline access.`,
      },
      {
        icon: "star-outline",
        title: msg`Favourite Exercises`,
        body: msg`Tap the star icon in the top-right corner of any exercise info screen to mark it as a favourite. Favourited exercises appear at the top of the exercise picker when building or editing workouts, so the exercises you use most are always within quick reach.`,
      },
      {
        icon: "create-outline",
        title: msg`Custom Exercises`,
        body: msg`Create your own exercises from the exercise picker. Give it a name, an optional image, body part, target muscles, secondary muscles, and equipment. Choose a tracking type: weight + reps, time, distance, reps only, or assisted (which factors in your body weight for movements like assisted pull-ups). Toggle Unilateral for single-arm or single-leg exercises; reps can be automatically doubled in your stats. Toggle Paired Implements if you track the weight of one implement rather than the total: for example, if you log 20 kg for one dumbbell, the app counts 40 kg toward your volume.`,
      },
      {
        icon: "barbell-outline",
        title: msg`Weight Tracking for Bodyweight Exercises`,
        body: msg`Bodyweight exercises like pull-ups or dips track reps only by default. If you want to log added weight, such as a weight belt or vest, open the sets overview for that exercise in the workout or plan editor and toggle Track Weight on. The toggle is saved per workout, so you can have some workouts use bodyweight-only and others track the additional load. Progression charts and history will reflect the logged weight once the toggle is on.`,
      },
    ],
  },
  {
    group: msg`Tracking`,
    sections: [
      {
        icon: "bulb-outline",
        title: msg`Insights`,
        body: msg`The Insights strip at the top of the Stats tab gives four at-a-glance highlights for the selected time range: your average workouts per week, your biggest strength gain across tracked exercises, the body part you have trained most, and your current weekly streak. These update automatically after each workout.`,
      },
      {
        icon: "stats-chart-outline",
        title: msg`Stats & History`,
        body: msg`The Stats tab shows total workouts, total volume, total time, and average session duration over a selectable time range, with a period-over-period delta for each metric. Charts display weekly volume and your training split by body part. Browse your full workout history and tap any session to review every set in detail, including weights, reps, time, or distance. You can edit or delete completed workouts from the history details screen. Tap the calendar icon in the Workout History section to open a calendar view: days with workouts are highlighted with a yellow circle, and tapping any day shows the workouts logged on that date.`,
      },
      {
        icon: "trending-up-outline",
        title: msg`Exercise Tracking`,
        body: msg`Pin exercises in the Stats tab to track their strength progression over time. Each tracked exercise shows a chart of your performance over the selected time range, your all-time personal record, your top sets, and a list of recent sessions showing the best set per day. Charts update automatically after each workout that includes that exercise.`,
      },
      {
        icon: "body-outline",
        title: msg`Body Measurements`,
        body: msg`Track your body composition over time from the Measurements section in the Stats tab. Use the Log Entry form to record values for any active metric, then tap a past entry in the History list to review or edit it. On the entry detail screen, tap a metric chip to switch the chart between different measurements and use the time range selector to zoom in or out. Metrics are split into three types: mass (weight, in kg or lbs), length (circumferences like waist and hips, in cm or in), and percentage (body fat). Units follow your weight and size preferences in Settings. To control which metrics appear in the entry form, tap Manage Metrics at the top of the Log Entry section. Built-in metrics can be toggled on or off; you can also create your own custom metrics and choose their type. Custom metrics can be hidden from the form at any time, and your historical data for them is always preserved.`,
      },
    ],
  },
  {
    group: msg`Customisation`,
    sections: [
      {
        icon: "settings-outline",
        title: msg`Settings`,
        body: msg`Configure weight, size, and distance units, default sets per exercise, default rest time, and the weight increment used by the ± buttons during a session. Adjust workout button size (Standard, Large, or XLarge) and toggle Keep Screen On to prevent the display sleeping mid-workout. Under Stats, you can exclude warmup sets from volume, double reps for unilateral exercises, or double the weight for paired implements, useful if you prefer logging per-dumbbell weight rather than the total. Set your body weight here; it is used to calculate effective load for assisted exercises.`,
      },
      {
        icon: "notifications-outline",
        title: msg`Workout Reminders`,
        body: msg`Enable recurring workout reminders from Settings. Select the days of the week you want to be reminded using the day chips and choose a time. You will receive a notification at that time on each selected day. Notification permission must be granted for reminders to work.`,
      },
    ],
  },
  {
    group: msg`Friends & Social`,
    sections: [
      {
        icon: "people-outline",
        title: msg`Adding Friends`,
        body: msg`Open the Friends tab from the menu to manage your connections. Use the search bar to find other users by username and send them a friend request. Incoming requests appear in the Requests tab; tap Accept to confirm or Decline to ignore. A badge on the Friends menu item shows how many pending requests are waiting. Once a request is accepted, both users appear in each other's Friends list and can view each other's shared content.`,
      },
      {
        icon: "share-social-outline",
        title: msg`Sharing Your Content`,
        body: msg`You can share plans, standalone workouts, custom exercises, body measurements, and strength PRs with your friends. All five categories have a global toggle in Privacy Settings, found in the Account section of Settings. Enabling the global toggle for a category shares all items in that category and syncs new data automatically whenever it changes. Plans and standalone workouts also have an individual Share toggle on each item's overview screen, so you can publish specific plans or workouts without sharing everything. A cloud icon on the plan or workout card confirms it is currently published. To remove shared data, disable the toggle in Privacy Settings and tap Delete Shared Data for that category. You can also delete all shared data for every category from the same screen.`,
      },
      {
        icon: "download-outline",
        title: msg`Importing from Friends`,
        body: msg`Tap any accepted friend in your Friends list to open their profile. Their profile shows the plans, standalone workouts, and custom exercises they have chosen to share. Tap Import on any item to add it directly to your own library. Imported plans and workouts are saved as new copies that you can edit freely without affecting the original. Imported custom exercises are added to your exercise library and available immediately when building workouts.`,
      },
    ],
  },
  {
    group: msg`Account`,
    sections: [
      {
        icon: "person-circle-outline",
        title: msg`Signing In`,
        body: msg`Tap Sign In With Google in Settings to connect your account. Signing in enables cloud backups so your data is safe if you switch devices or reinstall the app, and your name is shown in the home screen greeting. The app works fully offline without signing in, but cloud backups are unavailable. Your data is stored locally on your device and is not shared with anyone unless you choose to share it yourself.`,
      },
      {
        icon: "cloud-outline",
        title: msg`Backup & Restore`,
        body: msg`Sign in with Google in Settings to enable cloud backups of all your workout data. Tap Backup at any time to save a snapshot; the date of your last backup is shown beneath the button. Tap Restore to download and apply your latest backup; confirm the prompt and the app will reload with your restored data. Your backups are stored securely and are tied to your Google account. If you switch devices or reinstall the app, simply sign in with the same Google account and tap Restore to get your data back.`,
      },
    ],
  },
];
