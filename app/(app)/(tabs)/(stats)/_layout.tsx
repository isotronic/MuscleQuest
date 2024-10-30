import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";

export default function PlansLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.dark.background,
        },
        headerTintColor: Colors.dark.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Stats" }} />
      <Stack.Screen
        name="history-details"
        options={{ title: "Workout Details" }}
      />
      <Stack.Screen name="exercises" options={{ title: "Exercises" }} />
      <Stack.Screen name="edit-history" options={{ title: "Edit Workout" }} />
    </Stack>
  );
}
