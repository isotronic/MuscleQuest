import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Modal, Portal, Divider, IconButton } from "react-native-paper";
import { Calendar, DateData } from "react-native-calendars";
import { format, parseISO } from "date-fns";
import { ThemedText } from "@/components/ThemedText";
import WorkoutHistoryCard from "@/components/WorkoutHistoryCard";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { Colors } from "@/constants/Colors";

interface WorkoutCalendarModalProps {
  visible: boolean;
  onDismiss: () => void;
  markedDates: Record<string, object>;
  selectedDate: string | null;
  onDayPress: (dateString: string) => void;
  workoutsForSelectedDate: CompletedWorkout[];
  onWorkoutPress: (id: number) => void;
  excludeWarmup?: boolean;
}

const calendarTheme = {
  backgroundColor: Colors.dark.cardBackground,
  calendarBackground: Colors.dark.cardBackground,
  dayTextColor: Colors.dark.text,
  todayTextColor: Colors.dark.tint,
  selectedDayBackgroundColor: Colors.dark.tint,
  selectedDayTextColor: Colors.dark.background,
  dotColor: Colors.dark.tint,
  selectedDotColor: Colors.dark.background,
  monthTextColor: Colors.dark.text,
  arrowColor: Colors.dark.tint,
  textDisabledColor: Colors.dark.subText,
  textSectionTitleColor: Colors.dark.subText,
};

export const WorkoutCalendarModal: React.FC<WorkoutCalendarModalProps> = ({
  visible,
  onDismiss,
  markedDates,
  selectedDate,
  onDayPress,
  workoutsForSelectedDate,
  onWorkoutPress,
  excludeWarmup = false,
}) => {
  const formattedHeading = selectedDate
    ? format(parseISO(selectedDate), "EEEE, d MMMM")
    : null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
        theme={{ colors: { backdrop: "rgba(0, 0, 0, 0.65)" } }}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>Workout Calendar</ThemedText>
          <IconButton
            icon="close"
            size={20}
            iconColor={Colors.dark.subText}
            style={styles.closeButton}
            onPress={onDismiss}
          />
        </View>
        <Divider style={styles.divider} />
        <Calendar
          markedDates={markedDates}
          onDayPress={(day: DateData) => onDayPress(day.dateString)}
          theme={calendarTheme}
          markingType="dot"
        />
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
                ? "No workouts on this day."
                : "Select a day to see workouts."}
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
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 8,
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
  listContainer: {
    flexGrow: 0,
  },
  dateHeading: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.subText,
    marginBottom: 8,
  },
  emptyText: {
    color: Colors.dark.subText,
    marginTop: 4,
  },
});
