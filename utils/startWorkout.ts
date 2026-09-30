import { Alert } from "react-native";
import { t } from "@lingui/core/macro";
import { router } from "expo-router";
import Bugsnag from "@bugsnag/expo";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { resumeActiveWorkout } from "./resumeWorkout";

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
    } catch (e) {
      console.error("Failed to start workout:", e);
      Bugsnag.notify(e instanceof Error ? e : new Error(String(e)));
      setLoading(false);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  if (store.isWorkoutInProgress()) {
    Alert.alert(
      t`Workout In Progress`,
      t`You already have a workout running. Continue it or start a new one?`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Continue Workout`,
          onPress: resumeActiveWorkout,
        },
        {
          text: t`Start New`,
          style: "destructive",
          onPress: doStart,
        },
      ],
    );
    return;
  }

  await doStart();
};
