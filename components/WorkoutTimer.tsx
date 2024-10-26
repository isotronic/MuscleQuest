import { useEffect, useState } from "react";
import { View } from "react-native";
import { ThemedText } from "./ThemedText";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";

export const WorkoutTimer: React.FC = () => {
  const { startTime } = useActiveWorkoutStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!startTime) {
      return;
    }

    // Calculate initial elapsed seconds
    const initialElapsed = Math.floor(
      (Date.now() - new Date(startTime).getTime()) / 1000,
    );
    setElapsedSeconds(initialElapsed);

    // Update the timer every second
    const intervalId = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(intervalId); // Clean up on unmount
  }, [startTime]);

  // Format elapsed time as hours, minutes, and seconds
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <View>
      <ThemedText style={{ fontSize: 16, textAlign: "center" }}>
        {hours > 0 ? `${hours}:` : ""}
        {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
      </ThemedText>
    </View>
  );
};

export default WorkoutTimer;
