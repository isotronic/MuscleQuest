import { Stack } from "expo-router";
import { t } from "@lingui/core/macro";
import { useAppTheme } from "@/theme";

export default function WorkoutLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.contentPrimary,
      }}
    >
      <Stack.Screen name="index" options={{ title: t`Overview` }} />
      <Stack.Screen name="workout-session" options={{ title: t`Workout` }} />
      <Stack.Screen name="exercises" options={{ title: t`Exercises` }} />
      <Stack.Screen name="workout-summary" options={{ headerShown: false }} />
    </Stack>
  );
}
