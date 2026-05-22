import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";
import { t } from "@lingui/core/macro";

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
      <Stack.Screen name="index" options={{ title: t`Overview` }} />
      <Stack.Screen name="workout-session" options={{ title: t`Workout` }} />
      <Stack.Screen name="exercises" options={{ title: t`Exercises` }} />
      <Stack.Screen name="workout-summary" options={{ headerShown: false }} />
    </Stack>
  );
}
