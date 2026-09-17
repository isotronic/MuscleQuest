import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";

export type StepsBody = {
  lead: MessageDescriptor;
  steps: MessageDescriptor[];
  ordered?: boolean;
};

export type SectionData = {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: MessageDescriptor;
  body: MessageDescriptor | StepsBody;
};

export type GroupData = {
  id: string;
  group: MessageDescriptor;
  sections: SectionData[];
};

export function isStepsBody(body: SectionData["body"]): body is StepsBody {
  return typeof body === "object" && body !== null && "steps" in body;
}

export const HELP_DATA: GroupData[] = [
  {
    id: "training",
    group: msg`Training`,
    sections: [
      {
        id: "home-screen-weekly-goal",
        icon: "home-outline",
        title: msg`Home Screen & Weekly Goal`,
        body: msg`The home screen shows your progress toward your weekly training goal, which is the number of days you want to work out each week, set in Settings. A strip at the top tracks how many days you have completed and highlights each completed day. Below it, your active plan's workouts are listed with their completion status for the week; tap Start on any workout to begin. The card displayed beneath changes with your status: a Resume card appears if a session is in progress, a Rest Day card shows on days with no scheduled workout, and a Workout Done card confirms today's session is complete. When you hit your weekly goal, a Weekly Summary card appears showing total workouts, sets, and volume for the week, plus your streak, which counts the number of consecutive weeks you have met your goal.`,
      },
      {
        id: "plans",
        icon: "calendar-outline",
        title: msg`Plans`,
        body: {
          lead: msg`Plans are structured training programmes made up of workouts.`,
          steps: [
            msg`Go to the Plans tab, tap New Plan, give it a name, and pick a cover image.`,
            msg`Add workouts to the plan, then add exercises to each workout with target sets and reps. Each workout card shows an estimated duration and exercise count.`,
            msg`Reorder a workout card with the up/down arrow buttons, or remove it with the X button, both in the top right of the card.`,
            msg`Assign workouts to days in the schedule editor: tap a day to pick a workout or leave it as a rest day, or use the auto-suggest button to space them out evenly.`,
            msg`Open the plan and tap Activate when it's ready. Your edits are auto-saved as a draft, so you can leave and resume later.`,
            msg`Add notes to the plan from its overview screen, and switch between Carousel, List, and Grid views using the icons next to "Your Training Plans" (your choice is remembered).`,
            msg`To duplicate a plan, open it and tap Duplicate Plan for a full, editable copy.`,
          ],
        },
      },
      {
        id: "premade-plans",
        icon: "library-outline",
        title: msg`Premade Plans`,
        body: msg`The Plans tab includes a library of ready-made training programmes you can start immediately. Scroll past Your Training Plans to find the Premade Plans section. Tap any programme to preview its workouts and schedule, then tap Activate to make it your active plan. You can edit a premade plan to adjust exercises, sets, or the weekly schedule. This will create a copy of the premade plan that you can modify without affecting the original, so you can always return to the default version if needed.`,
      },
      {
        id: "workouts",
        icon: "barbell-outline",
        title: msg`Workouts`,
        body: msg`Standalone workouts live outside of plans and appear alongside your plans on the Plans screen. Create one by tapping New Workout, give it a name, and add exercises; you can run it at any time without needing an active plan. An estimated duration is shown on each standalone workout so you can plan your time before starting. Quick Workouts let you start a session immediately from the home screen: tap Quick Workout, add exercises as you go, and at the end you can save it as a standalone workout for future use or simply discard it. Tap Choose Workout next to it to search and browse every workout across your plans and standalone library, then start any one of them straight away. Like plans, the workout editor automatically saves a draft so you can safely leave and return without losing your work.`,
      },
      {
        id: "active-workout",
        icon: "play-circle-outline",
        title: msg`Active Workout`,
        body: {
          lead: msg`During a session, the header shows your total elapsed time throughout.`,
          steps: [
            msg`Swipe left/right or use the arrow buttons to move between sets.`,
            msg`Enter your weight and reps, then tap Complete Set.`,
            msg`Drag the handle on any exercise card to reorder exercises mid-session.`,
            msg`For time-based exercises, tap Start Timer to open a count-up timer with a progress ring marking your goal time; you can keep going past it.`,
            msg`Add notes per-exercise via the notes icon in the exercise header, per workout from the workout overview screen, or per plan from the plan overview screen.`,
            msg`If you add, remove, or reorder exercises or sets, you'll be prompted at the end to save those changes back to the original workout or plan.`,
          ],
        },
      },
      {
        id: "workout-summary",
        icon: "trophy-outline",
        title: msg`Workout Summary`,
        body: msg`After finishing a workout, a summary screen shows your total duration, sets completed, and total volume. If you have done the same workout before, a comparison row shows how each metric compares to the previous session. A weekly goal banner shows how many sessions you have logged this week against your goal. Tap any exercise in the list to expand it and review every set in detail. When completing a Quick Workout, you will be prompted to save it as a standalone workout for future use or discard it.`,
      },
      {
        id: "rest-timer",
        icon: "timer-outline",
        title: msg`Rest Timer`,
        body: {
          lead: msg`The rest timer starts automatically after each set and counts down to zero; each set remembers its own rest duration, so different sets within the same exercise can have different rest periods.`,
          steps: [
            msg`Use the ± buttons to adjust the remaining time on the fly during rest.`,
            msg`Configure the default rest duration and the timer increment in Settings.`,
            msg`Toggle a sound, vibration, or background notification for when the timer ends, each independently, in Settings.`,
          ],
          ordered: false,
        },
      },
      {
        id: "supersets",
        icon: "git-merge-outline",
        title: msg`Supersets`,
        body: {
          lead: msg`Group two exercises into a superset so they alternate automatically during a session, ideal for pairing antagonist muscles or staying efficient between sets.`,
          steps: [
            msg`In the workout editor, tap the three-dot menu on an exercise and choose Create Superset.`,
            msg`Select the second exercise to pair it with.`,
            msg`A coloured label identifies which superset each exercise belongs to throughout the app.`,
            msg`Completing a set on one exercise automatically moves you to its superset partner.`,
          ],
        },
      },
    ],
  },
  {
    id: "adaptive-progression",
    group: msg`Adaptive Progression`,
    sections: [
      {
        id: "overview",
        icon: "trending-up-outline",
        title: msg`Overview`,
        body: msg`Adaptive Progression analyses your effort feedback over consecutive sessions and suggests when to increase your weight, reps, or sets. Enable it in Settings under Adaptive Progression. Once on, a short feedback prompt appears after each exercise in plan-based workouts, provided the exercise has a defined rep range to progress within. The engine requires two sessions with the same signal before recommending an upward change, filtering out one-off easy days and ensuring consistent performance before suggesting an increase. Pain or failed sets act immediately regardless of your session history. Discomfort is tracked across sessions: a single report keeps the load steady, and recurring discomfort prompts a note to check your form. If an exercise has been stuck at the same load for four or more sessions, a plateau advisory appears alongside the suggestion to prompt a technique check or a brief deload. A suggestion is never applied to your workout without your explicit approval. You can also configure your preferred load increment per equipment category in the same section of Settings, for example 2.5 kg for barbell exercises and 2.0 kg for dumbbells.`,
      },
      {
        id: "post-exercise-feedback",
        icon: "chatbox-ellipses-outline",
        title: msg`Post-Exercise Feedback`,
        body: {
          lead: msg`After completing the last working set of an exercise, a feedback sheet slides up with two questions.`,
          steps: [
            msg`Effort: Easy (you could have done more), About right, Hard (near your limit), or Couldn't finish all sets.`,
            msg`Pain: No pain, Minor discomfort, or Pain or form issues.`,
            msg`Answering Easy adds a third question asking if you want to push harder next time, letting you deliberately hold the load even after a light session.`,
            msg`Answering Pain reveals an optional text field to note where you felt it.`,
            msg`Discomfort is tracked across sessions: one report keeps the load steady, a second consecutive report adds a form-check note.`,
            msg`The sheet can be dismissed without answering, and reps-only exercises without a rep range are skipped automatically since there's no room to progress within.`,
          ],
          ordered: false,
        },
      },
      {
        id: "progression-suggestions",
        icon: "checkbox-outline",
        title: msg`Progression Suggestions`,
        body: {
          lead: msg`After finishing a workout, the Workout Summary screen shows a Next Session card listing actionable suggestions for your exercises — each row shows the exercise name, the proposed change, why it's suggested, and the date you last increased load.`,
          steps: [
            msg`Tap Accept to apply a suggestion for your next session, or Dismiss to ignore it; Accept All applies every suggestion at once.`,
            msg`Accepted suggestions are pre-filled into the weight and rep fields next time you open that workout.`,
            msg`Suggestions to hold the current load don't appear in the card, since no action is needed.`,
            msg`A plateau advisory note appears if an exercise has been at the same load for four or more sessions.`,
            msg`A deload-week banner appears if three or more exercises in the workout show fatigue signs.`,
            msg`A Changes for this session card appears on the workout overview screen whenever you have accepted suggestions, so you can review targets before starting.`,
          ],
          ordered: false,
        },
      },
      {
        id: "recovery-check-in",
        icon: "heart-circle-outline",
        title: msg`Recovery Check-in`,
        body: msg`When you open a workout that contains exercises you trained recently, a Recovery Check-in sheet appears if those exercises have a pending progression suggestion and your last session was at least 12 hours ago. For each relevant muscle group, you choose one of three options: Fresh (fully recovered), Mild soreness, or Still very sore. If a muscle is marked as still very sore, any upward progression suggestion for exercises targeting that muscle is paused and held at the current load until you re-evaluate at the start of the following session. Fresh or Mild soreness does not affect suggestions. Tap Skip for now to bypass the check-in entirely; a skipped check-in is treated the same as fresh recovery, so pending suggestions are unaffected.`,
      },
      {
        id: "deload-week",
        icon: "calendar-clear-outline",
        title: msg`Deload Week`,
        body: msg`A deload is a planned recovery week where you train at reduced intensity to let your body fully recover before the next training block. Tap Mark as Deload Week on the plan overview screen to flag the current week as a deload. While the deload is active, the post-exercise feedback sheet does not appear and no new progression states are created or updated, so your suggestion history is not disrupted by the lighter sessions. The deload resets automatically at the start of the following week, and normal feedback and progression tracking resume without any manual action. If you change your mind, tapping the button again while the deload is active will clear it.`,
      },
    ],
  },
  {
    id: "sets-exercises",
    group: msg`Sets & Exercises`,
    sections: [
      {
        id: "set-types",
        icon: "options-outline",
        title: msg`Set Types`,
        body: {
          lead: msg`Each set can be flagged as a Warm-up, Drop Set, To Failure, or any combination of these; a badge next to the set shows its current type.`,
          steps: [
            msg`During a session, tap the menu (⋮) on a set to toggle types on or off, or tap Add Drop Set to append a new drop set pre-filled with the current set's weight and rest time.`,
            msg`When building a plan, use the checkboxes in the set editor, or tap Add Warm-up to insert a dedicated warm-up set at the top of the list.`,
            msg`Warm-up sets are visually grouped and separated from working sets; the Apply to All option only affects sets of the same type.`,
            msg`Exclude warm-up sets from volume and stats calculations in Settings.`,
          ],
          ordered: false,
        },
      },
      {
        id: "exercise-library",
        icon: "search-outline",
        title: msg`Exercise Library`,
        body: msg`Browse almost 1,000 exercises and filter by body part, target muscle, or equipment. Use the sort chips at the top to order exercises by Default, Active Plan, Recent, or Frequent, so the exercises most relevant to you appear first. When replacing an exercise, the filter automatically preselects the matching target muscle to help you find alternatives faster. Tap any exercise to view its animated demonstration, the muscles targeted, and a full history of every time you have performed it, including weights, reps, time, or distance per set. Download all exercise animations (~100 MB) in Settings for offline access.`,
      },
      {
        id: "favourite-exercises",
        icon: "star-outline",
        title: msg`Favourite Exercises`,
        body: msg`Tap the star icon in the top-right corner of any exercise info screen to mark it as a favourite. Favourited exercises appear at the top of the exercise picker when building or editing workouts, so the exercises you use most are always within quick reach.`,
      },
      {
        id: "custom-exercises",
        icon: "create-outline",
        title: msg`Custom Exercises`,
        body: {
          lead: msg`Create your own exercises from the exercise picker.`,
          steps: [
            msg`Give it a name, an optional image, body part, target muscles, secondary muscles, and equipment.`,
            msg`Choose a tracking type: weight + reps, time, distance, reps only, or assisted (factors in your body weight, for movements like assisted pull-ups).`,
            msg`Toggle Unilateral for single-arm or single-leg exercises; reps can be automatically doubled in your stats.`,
            msg`Toggle Paired Implements if you track one implement's weight rather than the total: for example, logging 20 kg for one dumbbell counts 40 kg toward your volume.`,
          ],
        },
      },
      {
        id: "weight-tracking-bodyweight",
        icon: "barbell-outline",
        title: msg`Weight Tracking for Bodyweight Exercises`,
        body: msg`Bodyweight exercises like pull-ups or dips track reps only by default. If you want to log added weight, such as a weight belt or vest, open the sets overview for that exercise in the workout or plan editor and toggle Track Weight on. The toggle is saved per workout, so you can have some workouts use bodyweight-only and others track the additional load. Progression charts and history will reflect the logged weight once the toggle is on.`,
      },
    ],
  },
  {
    id: "tracking",
    group: msg`Tracking`,
    sections: [
      {
        id: "insights",
        icon: "bulb-outline",
        title: msg`Insights`,
        body: msg`The Insights strip at the top of the Stats tab gives four at-a-glance highlights for the selected time range: your average workouts per week, your biggest strength gain across tracked exercises, the body part you have trained most, and your current weekly streak. These update automatically after each workout.`,
      },
      {
        id: "stats-history",
        icon: "stats-chart-outline",
        title: msg`Stats & History`,
        body: msg`The Stats tab shows total workouts, total volume, total time, and average session duration over a selectable time range, with a period-over-period delta for each metric. Charts display weekly volume and your training split by body part. Browse your full workout history and tap any session to review every set in detail, including weights, reps, time, or distance. You can edit or delete completed workouts from the history details screen. Tap the calendar icon in the Workout History section to open a calendar view: days with workouts are highlighted with a yellow circle, and tapping any day shows the workouts logged on that date.`,
      },
      {
        id: "exercise-tracking",
        icon: "trending-up-outline",
        title: msg`Exercise Tracking`,
        body: msg`Pin exercises in the Stats tab to track their strength progression over time. Each tracked exercise shows a chart of your performance over the selected time range, your all-time personal record, your top sets, and a list of recent sessions showing the best set per day. Charts update automatically after each workout that includes that exercise.`,
      },
      {
        id: "body-measurements",
        icon: "body-outline",
        title: msg`Body Measurements`,
        body: msg`Track your body composition over time from the Measurements section in the Stats tab. Use the Log Entry form to record values for any active metric, then tap a past entry in the History list to review or edit it. On the entry detail screen, tap a metric chip to switch the chart between different measurements and use the time range selector to zoom in or out. Metrics are split into three types: mass (weight, in kg or lbs), length (circumferences like waist and hips, in cm or in), and percentage (body fat). Units follow your weight and size preferences in Settings. To control which metrics appear in the entry form, tap Manage Metrics at the top of the Log Entry section. Built-in metrics can be toggled on or off; you can also create your own custom metrics and choose their type. Custom metrics can be hidden from the form at any time, and your historical data for them is always preserved.`,
      },
    ],
  },
  {
    id: "customisation",
    group: msg`Customisation`,
    sections: [
      {
        id: "settings",
        icon: "settings-outline",
        title: msg`Settings`,
        body: {
          lead: msg`Settings lets you tune units and defaults across the app.`,
          steps: [
            msg`Weight, size, and distance units, default sets per exercise, default rest time, and the ± weight increment used during a session.`,
            msg`Workout button size (Standard, Large, or XLarge), and Keep Screen On to stop the display sleeping mid-workout.`,
            msg`Under Stats: exclude warm-up sets from volume, double reps for unilateral exercises, or double the weight for paired implements (useful if you log per-dumbbell weight rather than the total).`,
            msg`Your body weight, used to calculate effective load for assisted exercises.`,
          ],
          ordered: false,
        },
      },
      {
        id: "workout-reminders",
        icon: "notifications-outline",
        title: msg`Workout Reminders`,
        body: msg`Enable recurring workout reminders from Settings. Select the days of the week you want to be reminded using the day chips and choose a time. You will receive a notification at that time on each selected day. Notification permission must be granted for reminders to work.`,
      },
    ],
  },
  {
    id: "friends-social",
    group: msg`Friends & Social`,
    sections: [
      {
        id: "adding-friends",
        icon: "people-outline",
        title: msg`Adding Friends`,
        body: msg`Open the Friends tab from the menu to manage your connections. Use the search bar to find other users by username and send them a friend request. Incoming requests appear in the Requests tab; tap Accept to confirm or Decline to ignore. A badge on the Friends menu item shows how many pending requests are waiting. Once a request is accepted, both users appear in each other's Friends list and can view each other's shared content.`,
      },
      {
        id: "sharing-content",
        icon: "share-social-outline",
        title: msg`Sharing Your Content`,
        body: msg`You can share plans, standalone workouts, custom exercises, body measurements, and strength PRs with your friends. All five categories have a global toggle in Privacy Settings, found in the Account section of Settings. Enabling the global toggle for a category shares all items in that category and syncs new data automatically whenever it changes. Plans and standalone workouts also have an individual Share toggle on each item's overview screen, so you can publish specific plans or workouts without sharing everything. A cloud icon on the plan or workout card confirms it is currently published. To remove shared data, disable the toggle in Privacy Settings and tap Delete Shared Data for that category. You can also delete all shared data for every category from the same screen.`,
      },
      {
        id: "importing-from-friends",
        icon: "download-outline",
        title: msg`Importing from Friends`,
        body: msg`Tap any accepted friend in your Friends list to open their profile. Their profile shows the plans, standalone workouts, and custom exercises they have chosen to share. Tap Import on any item to add it directly to your own library. Imported plans and workouts are saved as new copies that you can edit freely without affecting the original. Imported custom exercises are added to your exercise library and available immediately when building workouts.`,
      },
    ],
  },
  {
    id: "account",
    group: msg`Account`,
    sections: [
      {
        id: "signing-in",
        icon: "person-circle-outline",
        title: msg`Signing In`,
        body: msg`Tap Sign In With Google in Settings to connect your account. Signing in enables cloud backups so your data is safe if you switch devices or reinstall the app, and your name is shown in the home screen greeting. The app works fully offline without signing in, but cloud backups are unavailable. Your data is stored locally on your device and is not shared with anyone unless you choose to share it yourself.`,
      },
      {
        id: "backup-restore",
        icon: "cloud-outline",
        title: msg`Backup & Restore`,
        body: msg`Sign in with Google in Settings to enable cloud backups of all your workout data. Tap Backup at any time to save a snapshot; the date of your last backup is shown beneath the button. Tap Restore to download and apply your latest backup; confirm the prompt and the app will reload with your restored data. Your backups are stored securely and are tied to your Google account. If you switch devices or reinstall the app, simply sign in with the same Google account and tap Restore to get your data back.`,
      },
    ],
  },
];
