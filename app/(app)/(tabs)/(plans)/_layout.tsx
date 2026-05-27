import { Stack } from "expo-router";
import { t } from "@lingui/core/macro";
import { useAppTheme } from "@/theme";

export default function PlansLayout() {
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
      <Stack.Screen name="index" options={{ title: t`Plans` }} />
      <Stack.Screen name="overview" options={{ title: t`Plan Overview` }} />
      <Stack.Screen name="standalone-workout" options={{ title: t`Workout` }} />
    </Stack>
  );
}
