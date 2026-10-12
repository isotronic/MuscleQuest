import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Trans } from "@lingui/react/macro";
import { t, msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import Bugsnag from "@bugsnag/expo";
import { ThemedText } from "@/components/ThemedText";
import {
  SettingRow,
  SettingsScroll,
  SwitchRow,
} from "@/components/settings/SettingRow";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useSettingsOverlay } from "@/hooks/useSettingsOverlay";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import {
  rescheduleWorkoutReminders,
  requestNotificationPermission,
} from "@/utils/workoutReminder";

const REMINDER_DAY_LABELS = [
  msg`Mo`,
  msg`Tu`,
  msg`We`,
  msg`Th`,
  msg`Fr`,
  msg`Sa`,
  msg`Su`,
];
const REMINDER_DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];
// The chips show two letters; screen readers get the whole day.
const REMINDER_DAY_NAMES = [
  msg`Monday`,
  msg`Tuesday`,
  msg`Wednesday`,
  msg`Thursday`,
  msg`Friday`,
  msg`Saturday`,
  msg`Sunday`,
];

export default function RemindersSettingsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const { data: settings } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();
  const { showOverlay, overlay } = useSettingsOverlay();

  const [workoutReminderEnabled, setWorkoutReminderEnabled] = useState(false);
  const [workoutReminderDays, setWorkoutReminderDays] = useState<number[]>([]);

  // Sync local states with fetched settings data on load
  useEffect(() => {
    if (settings) {
      setWorkoutReminderEnabled(settings.workoutReminderEnabled === "true");
      try {
        const parsed = JSON.parse(settings.workoutReminderDays || "[]");
        setWorkoutReminderDays(Array.isArray(parsed) ? parsed : []);
      } catch {
        setWorkoutReminderDays([]);
      }
    }
  }, [settings]);

  const toggleWorkoutReminder = async (value: boolean) => {
    if (value) {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        Alert.alert(
          t`Permission Required`,
          t`To enable workout reminders, grant notification permissions in your device settings.`,
          [
            { text: t`Open Settings`, onPress: () => Linking.openSettings() },
            { text: t`Cancel`, style: "cancel" },
          ],
        );
        return;
      }
    }
    setWorkoutReminderEnabled(value);
    updateSetting({ key: "workoutReminderEnabled", value: value.toString() });
    rescheduleWorkoutReminders(
      value.toString(),
      JSON.stringify(workoutReminderDays),
      settings?.workoutReminderTime ?? "08:00",
    ).catch((err: any) => {
      Bugsnag.notify(err);
      console.error("Failed to reschedule workout reminders:", err);
    });
  };

  const toggleReminderDay = async (day: number) => {
    const newDays = workoutReminderDays.includes(day)
      ? workoutReminderDays.filter((d) => d !== day)
      : [...workoutReminderDays, day].sort((a, b) => a - b);
    setWorkoutReminderDays(newDays);
    updateSetting({
      key: "workoutReminderDays",
      value: JSON.stringify(newDays),
    });
    if (workoutReminderEnabled) {
      rescheduleWorkoutReminders(
        "true",
        JSON.stringify(newDays),
        settings?.workoutReminderTime ?? "08:00",
      ).catch((err: any) => {
        Bugsnag.notify(err);
        console.error("Failed to reschedule workout reminders:", err);
      });
    }
  };

  return (
    <SettingsScroll>
      {overlay}
      <SwitchRow
        id="workoutReminders"
        icon="bell"
        title={<Trans>Workout reminders</Trans>}
        label={t`Workout reminders`}
        value={workoutReminderEnabled ? t`Enabled` : t`Disabled`}
        checked={workoutReminderEnabled}
        onValueChange={toggleWorkoutReminder}
      />
      {workoutReminderEnabled && (
        <>
          <SettingRow
            icon="calendar-week"
            title={<Trans>Reminder days</Trans>}
            style={{ alignItems: "flex-start" }}
          >
            <View style={styles.dayChipsRow}>
              {REMINDER_DAY_LABELS.map((label, index) => {
                const dayValue = REMINDER_DAY_VALUES[index];
                const selected = workoutReminderDays.includes(dayValue);
                return (
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={_(REMINDER_DAY_NAMES[index])}
                    key={index}
                    onPress={() => toggleReminderDay(dayValue)}
                    style={[styles.dayChip, selected && styles.dayChipSelected]}
                  >
                    <ThemedText
                      style={[
                        styles.dayChipText,
                        selected && styles.dayChipTextSelected,
                      ]}
                    >
                      {_(label)}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
            {workoutReminderDays.length === 0 && (
              <ThemedText style={styles.reminderHint}>
                <Trans>Select at least one day</Trans>
              </ThemedText>
            )}
          </SettingRow>
          <SettingRow
            icon="clock-outline"
            title={<Trans>Reminder time</Trans>}
            value={settings?.workoutReminderTime ?? "08:00"}
            onPress={() =>
              showOverlay(
                "workoutReminderTime",
                settings?.workoutReminderTime ?? "08:00",
                "reminderTime",
              )
            }
          />
        </>
      )}
    </SettingsScroll>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    dayChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 8,
    },
    dayChip: {
      width: 36,
      height: 36,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.contentSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    dayChipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    dayChipText: {
      fontSize: 12,
      color: colors.contentSecondary,
    },
    dayChipTextSelected: {
      color: colors.background,
      fontWeight: "bold",
    },
    reminderHint: {
      fontSize: 12,
      color: colors.danger,
      marginTop: 6,
    },
  });
}
