import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Modal, Portal, Divider, IconButton } from "react-native-paper";
import { CalendarList, DateData } from "react-native-calendars";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { ThemedText } from "@/components/ThemedText";
import WorkoutHistoryCard from "@/components/WorkoutHistoryCard";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface WorkoutCalendarModalProps {
  visible: boolean;
  onDismiss: () => void;
  markedDates: Record<string, object>;
  selectedDate: string | null;
  onDayPress: (dateString: string) => void;
  workoutsForSelectedDate: CompletedWorkout[];
  onWorkoutPress: (id: number) => void;
  excludeWarmup?: boolean;
  loading?: boolean;
  pastScrollRange?: number;
}

// 16px modal margin + 16px padding on each side = 64px total
const CALENDAR_WIDTH = Dimensions.get("window").width - 64;

export const WorkoutCalendarModal: React.FC<WorkoutCalendarModalProps> = ({
  visible,
  onDismiss,
  markedDates,
  selectedDate,
  onDayPress,
  workoutsForSelectedDate,
  onWorkoutPress,
  excludeWarmup = false,
  loading = false,
  pastScrollRange = 24,
}) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const formattedHeading = selectedDate
    ? format(parseISO(selectedDate), "EEEE, d MMMM")
    : null;

  const [calendarReady, setCalendarReady] = useState(false);
  const [calendarCurrentDate, setCalendarCurrentDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );

  const currentMonthRef = useRef(format(new Date(), "yyyy-MM-dd"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calendarRef = useRef<any>(null);

  useLayoutEffect(() => {
    if (!visible) return;
    setCalendarReady(false);
    const timer = setTimeout(() => setCalendarReady(true), 300);
    return () => clearTimeout(timer);
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible) return;
    const targetDate = selectedDate ?? format(new Date(), "yyyy-MM-dd");
    currentMonthRef.current = targetDate;
    setCalendarCurrentDate(targetDate);
  }, [visible, selectedDate]);

  const handleDayPress = useCallback(
    (day: DateData) => onDayPress(day.dateString),
    [onDayPress],
  );

  const navigateMonth = useCallback((dir: "next" | "prev") => {
    const next = format(
      dir === "next"
        ? addMonths(parseISO(currentMonthRef.current), 1)
        : subMonths(parseISO(currentMonthRef.current), 1),
      "yyyy-MM-dd",
    );
    currentMonthRef.current = next;
    calendarRef.current?.scrollToMonth(next);
  }, []);

  const handleVisibleMonthsChange = useCallback((months: DateData[]) => {
    if (months[0]) {
      currentMonthRef.current = months[0].dateString;
      setCalendarReady(true);
    }
  }, []);

  const showSpinner = loading || !calendarReady;

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
            <Trans>Workout Calendar</Trans>
          </ThemedText>
          <IconButton
            icon="close"
            size={20}
            iconColor={colors.contentSecondary}
            style={styles.closeButton}
            onPress={onDismiss}
          />
        </View>
        <Divider style={styles.divider} />

        {/* CalendarList always renders at full height so onVisibleMonthsChange fires.
            Opaque overlay sits on top while the list is initialising. */}
        <View style={styles.calendarContainer}>
          <CalendarList
            ref={calendarRef}
            current={calendarCurrentDate}
            markedDates={markedDates}
            onDayPress={handleDayPress}
            theme={calendarTheme}
            markingType="custom"
            horizontal
            pagingEnabled
            firstDay={1}
            calendarWidth={CALENDAR_WIDTH}
            pastScrollRange={pastScrollRange}
            futureScrollRange={1}
            showScrollIndicator={false}
            hideArrows={false}
            onVisibleMonthsChange={handleVisibleMonthsChange}
            onPressArrowLeft={() => navigateMonth("prev")}
            onPressArrowRight={() => navigateMonth("next")}
          />
          {showSpinner && (
            <View style={styles.calendarOverlay}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          )}
        </View>

        {calendarReady && !loading && (
          <>
            <Divider style={styles.divider} />
            <ScrollView
              style={styles.listContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {formattedHeading && (
                <ThemedText style={styles.dateHeading}>
                  {formattedHeading}
                </ThemedText>
              )}
              {workoutsForSelectedDate.length === 0 ? (
                <ThemedText style={styles.emptyText}>
                  {selectedDate
                    ? t`No workouts on this day.`
                    : t`Select a day to see workouts.`}
                </ThemedText>
              ) : (
                workoutsForSelectedDate.map((workout) => (
                  <WorkoutHistoryCard
                    key={workout.id}
                    workout={workout}
                    excludeWarmup={excludeWarmup}
                    variant="vertical"
                    onPress={(id) => {
                      onDismiss();
                      onWorkoutPress(id);
                    }}
                  />
                ))
              )}
            </ScrollView>
          </>
        )}
      </Modal>
    </Portal>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      margin: 16,
      maxHeight: "82%",
      padding: 16,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      fontSize: 17,
      fontWeight: "bold",
    },
    closeButton: {
      margin: 0,
    },
    divider: {
      marginVertical: 8,
    },
    calendarContainer: {
      position: "relative",
    },
    calendarOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    listContainer: {
      flexGrow: 0,
    },
    dateHeading: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.contentSecondary,
      marginBottom: 8,
    },
    emptyText: {
      color: colors.contentSecondary,
      marginTop: 4,
    },
  });
}
