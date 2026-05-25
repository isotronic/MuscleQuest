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
      <Stack.Screen name="index" options={{ title: t`Stats` }} />
      <Stack.Screen
        name="history-details"
        options={{ title: t`Workout Details` }}
      />
      <Stack.Screen name="exercises" options={{ title: t`Exercises` }} />
      <Stack.Screen name="edit-history" options={{ title: t`Edit Workout` }} />
      <Stack.Screen name="exercise-detail" options={{ title: "" }} />
      <Stack.Screen name="measurements" options={{ title: t`Measurements` }} />
      <Stack.Screen
        name="measurements-detail"
        options={{ title: t`Entry Detail` }}
      />
      <Stack.Screen
        name="measurements-manage"
        options={{ title: t`Manage Metrics` }}
      />
    </Stack>
  );
}
