import { useEffect, useState } from "react";
import { View, AppState } from "react-native";
import { ThemedText } from "./ThemedText";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";

export const WorkoutTimer: React.FC = () => {
  const { startTime } = useActiveWorkoutStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!startTime) {
      return;
    }

    const calculateElapsedSeconds = () => {
      return Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
    };

    setElapsedSeconds(calculateElapsedSeconds());

    // Update the timer every second
    const intervalId = setInterval(() => {
      setElapsedSeconds(calculateElapsedSeconds());
    }, 1000);

    // Listen for app state changes to update elapsed time when returning from background
    const appStateListener = AppState.addEventListener(
      "change",
      (state: string) => {
        if (state === "active") {
          setElapsedSeconds(calculateElapsedSeconds());
        }
      },
    );

    return () => {
      clearInterval(intervalId);
      appStateListener.remove();
    };
  }, [startTime]);

  // Format elapsed time as hours, minutes, and seconds
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <View>
      <ThemedText style={{ fontSize: 16, textAlign: "center", marginLeft: 8 }}>
        {hours}:{minutes < 10 ? `0${minutes}` : minutes}:
        {seconds < 10 ? `0${seconds}` : seconds}
      </ThemedText>
    </View>
  );
};

export default WorkoutTimer;
