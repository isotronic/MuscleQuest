import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";

export type SectionData = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body: string;
};

export type GroupData = {
  group: string;
  sections: SectionData[];
};

export const HELP_DATA: GroupData[] = [
  {
    group: "Training",
    sections: [
      {
        icon: "home-outline",
        title: "Home Screen & Weekly Goal",
        body: "The home screen shows your progress toward your weekly training goal, which is the number of days you want to work out each week, set in Settings. A strip at the top tracks how many days you have completed and highlights each completed day. Below it, your active plan's workouts are listed with their completion status for the week; tap Start on any workout to begin. The card displayed beneath changes with your status: a Resume card appears if a session is in progress, a Rest Day card shows on days with no scheduled workout, and a Workout Done card confirms today's session is complete. When you hit your weekly goal, a Weekly Summary card appears showing total workouts, sets, and volume for the week, plus your streak, which counts the number of consecutive weeks you have met your goal.",
      },
      {
        icon: "calendar-outline",
        title: "Plans",
        body: "Plans are structured training programmes made up of workouts. To create one, go to the Plans tab, tap New Plan, give it a name, and pick a cover image. Add workouts to the plan, then add exercises to each workout with target sets and reps. Use the up/down arrow buttons on a workout card to reorder it, or the X button to remove it; both are in the top right of the card. Assign workouts to specific days of the week in the schedule editor: tap any day to pick a workout or leave it as a rest day, and use the auto-suggest button to space them out evenly. Once your plan is ready, open it and tap Activate. You can also add notes to a plan from the plan overview screen. Your progress in the plan editor is automatically saved as a draft, so if you leave mid-edit you will be prompted to continue where you left off or discard and start from the last saved state.",
      },
      {
        icon: "library-outline",
        title: "Premade Plans",
        body: "The Plans tab includes a library of ready-made training programmes you can start immediately. Scroll past Your Training Plans to find the Premade Plans section. Tap any programme to preview its workouts and schedule, then tap Activate to make it your active plan. You can edit a premade plan to adjust exercises, sets, or the weekly schedule. This will create a copy of the premade plan that you can modify without affecting the original, so you can always return to the default version if needed.",
      },
      {
        icon: "barbell-outline",
        title: "Workouts",
        body: "Standalone workouts live outside of plans and appear alongside your plans on the Plans screen. Create one by tapping New Workout, give it a name, and add exercises; you can run it at any time without needing an active plan. Quick Workouts let you start a session immediately from the home screen: tap Quick Workout, add exercises as you go, and at the end you can save it as a standalone workout for future use or simply discard it. Like plans, the workout editor automatically saves a draft so you can safely leave and return without losing your work.",
      },
      {
        icon: "play-circle-outline",
        title: "Active Workout",
        body: "During a session, swipe left/right or use the arrow buttons to move between sets. Enter your weight and reps, then tap Complete Set. The total elapsed time is shown in the header throughout. You can drag the handle on any exercise card to reorder exercises while the session is in progress. Time-based exercises have a Start Timer button that opens a count-up timer with a progress ring that shows you when you hit your goal time but you can keep going as long as you like. Notes can be added per-exercise via the notes icon in the exercise header, per workout from the workout overview screen, or per plan from the plan overview screen. If you add, remove, or reorder exercises or sets during a session, you will be prompted at the end to save those changes back to the original workout or plan.",
      },
      {
        icon: "trophy-outline",
        title: "Workout Summary",
        body: "After finishing a workout, a summary screen shows your total duration, sets completed, and total volume. If you have done the same workout before, a comparison row shows how each metric compares to the previous session. A weekly goal banner shows how many sessions you have logged this week against your goal. Tap any exercise in the list to expand it and review every set in detail. When completing a Quick Workout, you will be prompted to save it as a standalone workout for future use or discard it.",
      },
      {
        icon: "timer-outline",
        title: "Rest Timer",
        body: "The rest timer starts automatically after each set and counts down to zero. Each set remembers its own rest duration, so different sets within the same exercise can have different rest periods. Use the ± buttons to adjust the remaining time on the fly during rest. Configure the default rest duration, the timer increment, and whether a sound, vibration, or background notification fires at the end; each option is independently toggleable in Settings.",
      },
      {
        icon: "git-merge-outline",
        title: "Supersets",
        body: "Group two exercises into a superset so they alternate automatically during a session, ideal for pairing antagonist muscles or staying efficient between sets. Tap the three-dot menu on any exercise in the workout editor and choose Create Superset, then select the second exercise. A coloured label identifies which superset each exercise belongs to throughout the app. When you complete a set on one exercise, the app moves you straight to its superset partner.",
      },
    ],
  },
  {
    group: "Sets & Exercises",
    sections: [
      {
        icon: "options-outline",
        title: "Set Types",
        body: "Each set can be flagged as a Warmup, Drop Set, To Failure, or any combination of these. The badge shown next to a set displays its current type. To change the type during a session, tap the menu (⋮) and toggle the relevant option on or off. When building a plan, use the checkboxes in the set editor; tap Add Warm-up to insert a dedicated warm-up set at the top of the list. Warm-up sets are visually grouped and separated from working sets, and the Apply to All option in the edit modal only affects sets of the same type. Warmup sets can be excluded from volume and stats calculations in Settings.",
      },
      {
        icon: "search-outline",
        title: "Exercise Library",
        body: "Browse almost 1,000 exercises and filter by body part, target muscle, or equipment. When replacing an exercise, the filter automatically preselects the matching target muscle to help you find alternatives faster. Tap any exercise to view its animated demonstration, the muscles targeted, and a full history of every time you have performed it, including weights, reps, time, or distance per set. Download all exercise animations (~100 MB) in Settings for offline access.",
      },
      {
        icon: "star-outline",
        title: "Favourite Exercises",
        body: "Tap the star icon in the top-right corner of any exercise info screen to mark it as a favourite. Favourited exercises appear at the top of the exercise picker when building or editing workouts, so the exercises you use most are always within quick reach.",
      },
      {
        icon: "create-outline",
        title: "Custom Exercises",
        body: "Create your own exercises from the exercise picker. Give it a name, an optional image, body part, target muscles, secondary muscles, and equipment. Choose a tracking type: weight + reps, time, distance, reps only, or assisted (which factors in your body weight for movements like assisted pull-ups). Toggle Unilateral for single-arm or single-leg exercises; reps can be automatically doubled in your stats. Toggle Paired Implements if you track the weight of one implement rather than the total: for example, if you log 20 kg for one dumbbell, the app counts 40 kg toward your volume.",
      },
    ],
  },
  {
    group: "Tracking",
    sections: [
      {
        icon: "bulb-outline",
        title: "Insights",
        body: "The Insights strip at the top of the Stats tab gives four at-a-glance highlights for the selected time range: your average workouts per week, your biggest strength gain across tracked exercises, the body part you have trained most, and your current weekly streak. These update automatically after each workout.",
      },
      {
        icon: "stats-chart-outline",
        title: "Stats & History",
        body: "The Stats tab shows total workouts, total volume, total time, and average session duration over a selectable time range, with a period-over-period delta for each metric. Charts display weekly volume and your training split by body part. Browse your full workout history and tap any session to review every set in detail, including weights, reps, time, or distance. You can edit or delete completed workouts from the history details screen.",
      },
      {
        icon: "trending-up-outline",
        title: "Exercise Tracking",
        body: "Pin exercises in the Stats tab to track their strength progression over time. Each tracked exercise shows a chart of your performance over the selected time range, your all-time personal record, your top sets, and a list of recent sessions showing the best set per day. Charts update automatically after each workout that includes that exercise.",
      },
    ],
  },
  {
    group: "Customisation",
    sections: [
      {
        icon: "settings-outline",
        title: "Settings",
        body: "Configure weight and distance units, default sets per exercise, default rest time, and the weight increment used by the ± buttons during a session. Adjust workout button size (Standard, Large, or XLarge) and toggle Keep Screen On to prevent the display sleeping mid-workout. Under Stats, you can exclude warmup sets from volume, double reps for unilateral exercises, or double the weight for paired implements, useful if you prefer logging per-dumbbell weight rather than the total. Set your body weight here; it is used to calculate effective load for assisted exercises.",
      },
      {
        icon: "notifications-outline",
        title: "Workout Reminders",
        body: "Enable recurring workout reminders from Settings. Select the days of the week you want to be reminded using the day chips and choose a time. You will receive a notification at that time on each selected day. Notification permission must be granted for reminders to work.",
      },
    ],
  },
  {
    group: "Account",
    sections: [
      {
        icon: "person-circle-outline",
        title: "Signing In",
        body: "Tap Sign In With Google in Settings to connect your account. Signing in enables cloud backups so your data is safe if you switch devices or reinstall the app, and your name is shown in the home screen greeting. The app works fully offline without signing in, but cloud backups are unavailable. Your data is stored locally on your device and is not shared with anyone unless you choose to share it yourself.",
      },
      {
        icon: "cloud-outline",
        title: "Backup & Restore",
        body: "Sign in with Google in Settings to enable cloud backups of all your workout data. Tap Backup at any time to save a snapshot; the date of your last backup is shown beneath the button. Tap Restore to download and apply your latest backup; confirm the prompt and the app will reload with your restored data. Your backups are stored securely and are tied to your Google account. If you switch devices or reinstall the app, simply sign in with the same Google account and tap Restore to get your data back.",
      },
    ],
  },
];
