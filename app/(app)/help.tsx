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
          Welcome to MuscleQuest. Here&apos;s a quick guide to help you get the
          most out of the app.
        </Text>

        <Divider style={styles.topDivider} />

        <Section icon="barbell-outline" title="Plans">
          Plans are structured training programmes made up of workouts. Each
          workout contains exercises with sets, reps, and target weights. Create
          a plan from the Plans tab, assign workouts to days of the week, and
          activate it when you&apos;re ready to start training.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="fitness-outline" title="Workouts">
          A workout is a collection of exercises performed in a single session.
          You can run a workout as part of an active plan, or start a standalone
          workout from the Plans tab at any time. During a session, log your
          sets by entering weight and reps, then mark each set as complete.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="layers-outline" title="Supersets">
          Group two or more exercises into a superset by long-pressing an
          exercise during plan creation. Exercises in the same superset
          alternate automatically during a workout session, so you move
          seamlessly between them without manual navigation.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="timer-outline" title="Rest Timer">
          After completing a set, the rest timer starts automatically. You can
          adjust the default rest duration per exercise and change the rest
          timer increment in Settings. Notifications, sounds, and vibration can
          all be configured to alert you when rest is over.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="stats-chart-outline" title="Stats & History">
          The Stats tab shows your workout history, volume trends, and
          per-exercise progress over time. Tap any completed workout to review
          the sets you performed. Use the exercise detail view to see strength
          progression charts.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="sync-outline" title="Backup & Restore">
          Sign in with Google in Settings to enable cloud backup. Your workout
          data is backed up to Google Drive and can be restored at any time —
          useful if you switch devices or reinstall the app.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="settings-outline" title="Settings Overview">
          Settings lets you configure units (kg/lbs, m/ft), workout behaviour,
          rest timer sounds, exercise defaults, workout reminders, and
          appearance options. The weekly workout goal tracks how often you train
          each week.
        </Section>

        <Divider style={styles.divider} />

        <Section icon="bulb-outline" title="Tips">
          {"• Use the weight increment setting to match your gym's smallest plate.\n" +
            "• Enable background notifications so rest timer alerts work while the screen is off.\n" +
            "• The 'Exclude warmup sets' toggle in Stats settings keeps volume numbers accurate.\n" +
            "• Long-press a workout card in a plan to reorder or delete it."}
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
