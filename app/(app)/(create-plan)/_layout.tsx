import { Colors } from "@/constants/Colors";
import { Stack } from "expo-router";
import { t } from "@lingui/core/macro";

export default function CreatePlanLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.dark.background,
        },
        headerTintColor: Colors.dark.text,
      }}
    >
      <Stack.Screen name="create" options={{ title: t`Create Plan` }} />
      <Stack.Screen
        name="create-workout"
        options={{ title: t`Create Workout` }}
      />
      <Stack.Screen
        name="image-search"
        options={{ title: t`Images by Unsplash` }}
      />
      <Stack.Screen name="exercises" options={{ title: t`Exercises` }} />
      <Stack.Screen
        name="sets-overview"
        options={{ title: t`Sets Overview` }}
      />
    </Stack>
  );
}
