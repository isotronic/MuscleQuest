import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ScrollView } from "react-native";
import { Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import WeekDays from "@/components/WeekDays";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";
import { Colors } from "@/constants/Colors";
import { useActivePlanQuery } from "@/hooks/useActivePlanQuery";
import { router } from "expo-router";

export default function HomeScreen() {
  const user = useContext(AuthContext);
  const userName = user?.displayName
    ? ", " + user.displayName.split(" ")[0]
    : "";

  const { data: activePlan, isLoading } = useActivePlanQuery();

  if (isLoading) {
    return <ThemedText>Loading...</ThemedText>;
  }

  return (
    <ThemedView>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.weekContainer}>
          <WeekDays />
        </View>
        <View style={styles.summaryContainer}>
          <ThemedText style={styles.summaryText}>
            X / Y days worked out
          </ThemedText>
        </View>
        <View style={styles.welcomeContainer}>
          <ThemedText type="subtitle">Welcome{userName}</ThemedText>
          <ThemedText type="default">
            Your journey to Swoletown begins today!
          </ThemedText>
        </View>

        <View style={styles.cardContainer}>
          {activePlan ? (
            <>
              <ThemedText type="default" style={styles.sectionTitle}>
                Active Plan: {activePlan.name}
              </ThemedText>

              {activePlan.plan_data.map((workout, index) => (
                <View key={index} style={styles.workoutCard}>
                  <View style={styles.workoutCardContent}>
                    <MaterialCommunityIcons
                      name="weight-lifter"
                      size={30}
                      color={Colors.dark.icon}
                    />
                    <View style={styles.workoutTextContainer}>
                      <ThemedText
                        type="subtitle"
                        style={styles.workoutCardTitle}
                      >
                        {workout.name || `Day ${index + 1}`}
                      </ThemedText>
                      <ThemedText style={styles.exerciseInfo}>
                        {workout.exercises.length} Exercises
                      </ThemedText>
                    </View>
                    <View style={styles.smallButtonGroup}>
                      <Button
                        mode="contained"
                        onPress={() =>
                          console.log(
                            `Start workout: ${workout.name || `Day ${index + 1}`}`,
                          )
                        }
                        style={styles.smallButton}
                        labelStyle={styles.smallButtonLabel}
                      >
                        Start
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() =>
                          router.push(
                            `/workout-details?planId=${activePlan.id}&workoutIndex=${index}`,
                          )
                        }
                        style={styles.smallButton}
                        labelStyle={styles.smallButtonLabel}
                      >
                        View
                      </Button>
                    </View>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <ThemedText type="default" style={styles.sectionTitle}>
              No Active Plan
            </ThemedText>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            textColor={Colors.dark.text}
            icon={() => (
              <MaterialCommunityIcons
                name="arm-flex"
                size={25}
                color={Colors.dark.icon}
              />
            )}
            onPress={() => console.log("Start a workout pressed")}
            style={styles.startWorkoutButton}
            labelStyle={styles.buttonLabel}
          >
            Quickstart workout
          </Button>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  weekContainer: {
    flexDirection: "column",
    alignItems: "center",
  },
  summaryContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomColor: "black",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryText: {
    fontSize: 16,
    textAlign: "right",
  },
  welcomeContainer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  cardContainer: {
    padding: 20,
  },
  sectionTitle: {
    marginBottom: 10,
  },
  workoutCard: {
    marginBottom: 15,
    borderRadius: 10,
    backgroundColor: Colors.dark.cardBackground,
    padding: 20,
  },
  workoutCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  workoutTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  workoutCardTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "bold",
  },
  exerciseInfo: {
    color: Colors.dark.subText,
    fontSize: 14,
  },
  smallButtonGroup: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  smallButton: {
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  smallButtonLabel: {
    fontSize: 12,
    paddingVertical: 0,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  startWorkoutButton: {
    borderRadius: 15,
    width: "100%",
    height: 50,
  },
  buttonLabel: {
    fontSize: 18,
    lineHeight: 27,
  },
});
