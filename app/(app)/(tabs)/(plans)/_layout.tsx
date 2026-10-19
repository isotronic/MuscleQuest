import { Stack } from "expo-router";
import { t } from "@lingui/core/macro";
import { useAppTheme } from "@/theme";

// No initialRouteName/anchor here: expo-router ranks a group's anchor first
// when matching "/", so the app would open on Plans instead of Home.
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
    </Stack>
  );
}
