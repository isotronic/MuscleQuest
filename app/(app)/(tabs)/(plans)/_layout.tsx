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
      <Stack.Screen name="index" options={{ title: "Plans" }} />
      <Stack.Screen name="overview" options={{ title: "Plan Overview" }} />
      <Stack.Screen
        name="workout-details"
        options={{ title: "Workout Details" }}
      />
    </Stack>
  );
}
