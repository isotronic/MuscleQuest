import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";
import { t } from "@lingui/core/macro";

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
      <Stack.Screen name="index" options={{ title: t`Plans` }} />
      <Stack.Screen name="overview" options={{ title: t`Plan Overview` }} />
      <Stack.Screen name="standalone-workout" options={{ title: t`Workout` }} />
    </Stack>
  );
}
