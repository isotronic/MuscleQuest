import { Stack } from "expo-router";
import { t } from "@lingui/core/macro";
import { useAppTheme } from "@/theme";

// Opening the overview straight from Get started still puts the plans list
// under it, so Back lands there.
export const unstable_settings = { initialRouteName: "index" };

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
