import { Alert } from "react-native";
import { router } from "expo-router";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";

export const confirmStartWorkout = async (
  setLoading: (v: boolean) => void,
  onStart: () => void,
): Promise<void> => {
  const store = useActiveWorkoutStore.getState();

  const doStart = async () => {
    setLoading(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    try {
      onStart();
      router.push("/(app)/(workout)");
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  if (store.isWorkoutInProgress()) {
    Alert.alert(
      "Workout In Progress",
      "You already have a workout running. Continue it or start a new one?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue Workout",
          onPress: () => router.push("/(app)/(workout)"),
        },
        {
          text: "Start New",
          style: "destructive",
          onPress: doStart,
        },
      ],
    );
    return;
  }

  await doStart();
};
