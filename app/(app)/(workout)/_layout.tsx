import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";

export default function WorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.dark.background,
        },
        headerTintColor: Colors.dark.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Workout Overview" }} />
      <Stack.Screen
        name="workout-session"
        options={{ title: "Workout Session" }}
      />
    </Stack>
  );
}
