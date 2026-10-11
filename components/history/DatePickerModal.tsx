import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Modal, Portal } from "react-native-paper";
import { Calendar, DateData } from "react-native-calendars";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIconButton } from "@/components/ui";
import { toLocalDateKey } from "@/utils/dates";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface DatePickerModalProps {
  visible: boolean;
  /** The selected day, "YYYY-MM-DD". */
  value: string;
  onDismiss: () => void;
  onChange: (localDate: string) => void;
}

/** Picks a training day up to today; later days are disabled. */
export function DatePickerModal({
  visible,
  value,
  onDismiss,
  onChange,
}: DatePickerModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = toLocalDateKey(new Date());
  const calendarTheme = useMemo(
    () => ({
      backgroundColor: colors.card,
      calendarBackground: colors.card,
      dayTextColor: colors.contentPrimary,
      todayTextColor: colors.accent,
      selectedDayBackgroundColor: colors.accent,
      selectedDayTextColor: colors.background,
      monthTextColor: colors.contentPrimary,
      arrowColor: colors.accent,
      textDisabledColor: colors.contentSecondary,
      textSectionTitleColor: colors.contentSecondary,
    }),
    [colors],
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
        theme={{ colors: { backdrop: colors.modalBackdrop } }}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>
            <Trans>Date</Trans>
          </ThemedText>
          <AppIconButton
            accessibilityLabel={t`Close`}
            icon="close"
            size={20}
            iconColor={colors.contentSecondary}
            onPress={onDismiss}
          />
        </View>
        <Calendar
          current={value}
          maxDate={today}
          firstDay={1}
          disableAllTouchEventsForDisabledDays
          markedDates={{ [value]: { selected: true } }}
          onDayPress={(day: DateData) => {
            if (day.dateString > today) return;
            onChange(day.dateString);
            onDismiss();
          }}
          theme={calendarTheme}
        />
      </Modal>
    </Portal>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      margin: 16,
      padding: 16,
      borderRadius: radii.lg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    title: { fontSize: 18, fontWeight: "bold" },
  });
}
