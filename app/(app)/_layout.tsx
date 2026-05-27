import { Redirect, Stack } from "expo-router";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { ThemedView } from "@/components/ThemedView";
import { t } from "@lingui/core/macro";
import { useAppTheme } from "@/theme";

export default function AppLayout() {
  const { colors } = useAppTheme();
  const { data: settings, isLoading: settingsLoading } = useSettingsQuery();

  if (settingsLoading) {
    return <ThemedView style={{ flex: 1 }}></ThemedView>;
  }

  if (settings && !settings.loginShown) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.contentPrimary,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(create-plan)" options={{ headerShown: false }} />
      <Stack.Screen name="(workout)" options={{ headerShown: false }} />
      <Stack.Screen
        name="workout-details"
        options={{ title: t`Workout Details` }}
      />
      <Stack.Screen
        name="exercise-info"
        options={{ title: t`Exercise Info` }}
      />
      <Stack.Screen name="custom-exercise" />
      <Stack.Screen name="settings" options={{ title: t`Settings` }} />
      <Stack.Screen name="help" options={{ title: t`Help & Info` }} />
      <Stack.Screen
        name="exercise-library"
        options={{ title: t`Exercise Library` }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
