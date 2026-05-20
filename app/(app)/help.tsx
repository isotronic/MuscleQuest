import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Divider } from "react-native-paper";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/ThemedView";

type SectionProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  children: React.ReactNode;
};

function GroupHeader({ label }: { label: string }) {
  return (
    <View style={styles.groupHeader}>
      <Text style={styles.groupHeaderText}>{label}</Text>
    </View>
  );
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons
          name={icon}
          size={20}
          color={Colors.dark.tint}
          style={styles.sectionIcon}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

export default function HelpScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Welcome to MuscleQuest, your personal strength training companion. Use
          this guide to discover the features and get the most from your
          training.
        </Text>

        <Divider style={styles.topDivider} />

        {/* ── TRAINING ─────────────────────────────────── */}
        <GroupHeader label="Training" />

        <Section icon="calendar-outline" title="Plans">
          Plans are structured training programmes made up of workouts. To
          create one, go to the Plans tab, tap New Plan, give it a name, and
          pick a cover image. Add workouts to the plan, then add exercises to
          each workout with target sets and reps. Use the up/down arrow buttons
          on a workout card to reorder it, or the X button to remove it; both
          are in the top right of the card. Assign workouts to specific days of
          the week in the schedule editor: tap any day to pick a workout or
          leave it as a rest day, and use the auto-suggest button to space them
          out evenly. Once your plan is ready, open it and tap Activate. You can
          also add notes to a plan from the plan overview screen.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="barbell-outline" title="Workouts">
          Standalone workouts live outside of plans and appear alongside your
          plans on the Plans screen. Create one by tapping New Workout, give it
          a name, and add exercises; you can run it at any time without needing
          an active plan. Quick Workouts let you start a session immediately
          from the home screen: tap Quick Workout, add exercises as you go, and
          at the end you can save it as a standalone workout for future use or
          simply discard it.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="play-circle-outline" title="Active Workout">
          During a session, swipe left/right or use the arrow buttons to move
          between sets. Enter your weight and reps, then tap Complete Set. The
          total elapsed time is shown in the header throughout. You can drag the
          handle on any exercise card to reorder exercises while the session is
          in progress. Time-based exercises have a Start Timer button that opens
          a count-up timer with a progress ring that shows you when you hit your
          goal time but you can keep going as long as you like. Notes can be
          added per-exercise via the notes icon in the exercise header, per
          workout from the workout overview screen, or per plan from the plan
          overview screen. If you add, remove, or reorder exercises or sets
          during a session, you will be prompted at the end to save those
          changes back to the original workout or plan.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="git-merge-outline" title="Supersets">
          Group two exercises into a superset so they alternate automatically
          during a session, ideal for pairing antagonist muscles or staying
          efficient between sets. Tap the three-dot menu on any exercise in the
          workout editor and choose Create Superset, then select the second
          exercise. A coloured label identifies which superset each exercise
          belongs to throughout the app. When you complete a set on one
          exercise, the app moves you straight to its superset partner.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="timer-outline" title="Rest Timer">
          The rest timer starts automatically after each set and counts down to
          zero. Each set remembers its own rest duration, so different sets
          within the same exercise can have different rest periods. Use the ±
          buttons to adjust the remaining time on the fly during rest. Configure
          the default rest duration, the timer increment, and whether a sound,
          vibration, or background notification fires at the end; each option is
          independently toggleable in Settings.
        </Section>

        {/* ── SETS & EXERCISES ─────────────────────────── */}
        <GroupHeader label="Sets & Exercises" />

        <Section icon="options-outline" title="Set Types">
          Each set can be flagged as a Warmup, Drop Set, To Failure, or any
          combination of these. The badge shown next to a set displays its
          current type. To change the type during a session, tap the menu (⋮)
          and toggle the relevant option on or off. When building a plan, use
          the checkboxes in the set editor. Warmup sets can be excluded from
          volume and stats calculations in Settings.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="search-outline" title="Exercise Library">
          Browse almost 1,000 exercises and filter by body part, target muscle,
          or equipment. When replacing an exercise, the filter automatically
          preselects the matching target muscle to help you find alternatives
          faster. Tap any exercise to view its animated demonstration, the
          muscles targeted, and a full history of every time you have performed
          it, including weights, reps, time, or distance per set. Download all
          exercise animations (~100 MB) in Settings for offline access.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="create-outline" title="Custom Exercises">
          Create your own exercises from the exercise picker. Give it a name, an
          optional image, body part, target muscles, secondary muscles, and
          equipment. Choose a tracking type: weight + reps, time, distance, reps
          only, or assisted (which factors in your body weight for movements
          like assisted pull-ups). Toggle Unilateral for single-arm or
          single-leg exercises; reps can be automatically doubled in your stats.
          Toggle Paired Implements if you track the weight of one implement
          rather than the total: for example, if you log 20 kg for one dumbbell,
          the app counts 40 kg toward your volume.
        </Section>

        {/* ── TRACKING ─────────────────────────────────── */}
        <GroupHeader label="Tracking" />

        <Section icon="stats-chart-outline" title="Stats & History">
          The Stats tab shows total workouts, total volume, total time, and
          average session duration over a selectable time range, with a
          period-over-period delta for each metric. Charts display weekly volume
          and your training split by body part. Browse your full workout history
          and tap any session to review every set in detail, including weights,
          reps, time, or distance. You can edit or delete completed workouts
          from the history details screen.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="trending-up-outline" title="Exercise Tracking">
          Pin exercises in the Stats tab to track their strength progression
          over time. Each tracked exercise shows a chart of your performance
          over the selected time range, your all-time personal record, your top
          sets, and a list of recent sessions showing the best set per day.
          Charts update automatically after each workout that includes that
          exercise.
        </Section>

        {/* ── CUSTOMISATION ────────────────────────────── */}
        <GroupHeader label="Customisation" />

        <Section icon="settings-outline" title="Settings">
          Configure weight and distance units, default sets per exercise,
          default rest time, and the weight increment used by the ± buttons
          during a session. Adjust workout button size (Standard, Large, or
          XLarge) and toggle Keep Screen On to prevent the display sleeping
          mid-workout. Under Stats, you can exclude warmup sets from volume,
          double reps for unilateral exercises, or double the weight for paired
          implements, useful if you prefer logging per-dumbbell weight rather
          than the total. Set your body weight here; it is used to calculate
          effective load for assisted exercises.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="notifications-outline" title="Workout Reminders">
          Enable recurring workout reminders from Settings. Select the days of
          the week you want to be reminded using the day chips and choose a
          time. You will receive a notification at that time on each selected
          day. Notification permission must be granted for reminders to work.
        </Section>

        {/* ── ACCOUNT ──────────────────────────────────── */}
        <GroupHeader label="Account" />

        <Section icon="cloud-outline" title="Backup & Restore">
          Sign in with Google in Settings to enable cloud backups of all your
          workout data. Tap Backup at any time to save a snapshot; the date of
          your last backup is shown beneath the button. Tap Restore to download
          and apply your latest backup; confirm the prompt and the app will
          reload with your restored data. Your backups are stored securely and
          are tied to your Google account.
        </Section>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  intro: {
    fontSize: 15,
    color: Colors.dark.subText,
    lineHeight: 22,
    marginBottom: 16,
  },
  topDivider: {
    backgroundColor: Colors.dark.cardBackground,
    marginBottom: 16,
  },
  groupHeader: {
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  groupHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.dark.subText,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionIcon: {
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  sectionBody: {
    fontSize: 14,
    color: Colors.dark.subText,
    lineHeight: 21,
    paddingLeft: 30,
  },
  divider: {
    backgroundColor: Colors.dark.cardBackground,
    marginVertical: 16,
  },
  bottomPadding: {
    height: 32,
  },
});
