import { StyleSheet } from "react-native";
import ScreenHeader from "@/components/ScreenHeader";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { Button, Card } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import WeekDays from "@/components/WeekDays";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";
import { Colors } from "@/constants/Colors";

const dummyWorkouts = [
  { id: 1, title: "Legs and Glutes" },
  { id: 2, title: "Back and Biceps" },
  { id: 3, title: "Shoulders and Abs" },
];

export default function HomeScreen() {
  const user = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const userName = ", " + user?.displayName?.split(" ")[0] || "";

  return (
    <ThemedView>
      <ScrollView
        stickyHeaderIndices={[0]}
        style={{ marginTop: insets.top }}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <ScreenHeader title="MuscleQuest" />
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
          <Button
            mode="contained"
            onPress={() => console.log("Today's workout pressed")}
            style={styles.cardButton}
            contentStyle={styles.cardContent}
          >
            <View>
              <ThemedText style={styles.todayCardTitle}>
                Today's Workout: Chest and Triceps
              </ThemedText>
              <View style={styles.imageContainer}>
                <Card.Cover
                  source={{
                    uri: "https://images.unsplash.com/photo-1652363722833-509b3aac287b?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
                  }}
                  style={styles.cardImage}
                />
              </View>
            </View>
          </Button>
        </View>
        <View style={styles.otherWorkoutsContainer}>
          <ThemedText type="default" style={styles.sectionTitle}>
            Upcoming Workouts
          </ThemedText>
          {dummyWorkouts.map((workout) => (
            <Button
              key={workout.id}
              mode="contained"
              onPress={() => console.log(`${workout.title} pressed`)}
              style={styles.smallCardButton}
              contentStyle={styles.smallCardContent}
            >
              <ThemedText type="subtitle" style={styles.cardTitle}>
                {workout.title}
              </ThemedText>
            </Button>
          ))}
        </View>
        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            textColor={Colors.dark.text}
            icon={() => (
              <MaterialCommunityIcons
                name="dumbbell"
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
  cardButton: {
    borderRadius: 15,
    backgroundColor: Colors.dark.cardBackground,
    padding: 0,
    width: "100%",
  },
  cardContent: {
    alignItems: "flex-start",
    width: "100%",
  },
  imageContainer: {
    width: "100%",
    borderRadius: 15,
    overflow: "hidden",
  },
  cardImage: {
    marginTop: 10,
    width: "100%",
  },
  todayCardTitle: {
    color: Colors.dark.text,
    paddingBottom: 10,
  },
  otherWorkoutsContainer: {
    padding: 20,
  },
  sectionTitle: {
    marginBottom: 10,
  },
  smallCardButton: {
    marginBottom: 15,
    borderRadius: 15,
    backgroundColor: Colors.dark.cardBackground,
  },
  smallCardContent: {
    height: 60,
    justifyContent: "center",
  },
  cardTitle: {
    color: Colors.dark.text,
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
