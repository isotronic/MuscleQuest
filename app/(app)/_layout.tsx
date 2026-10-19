import { Redirect, Stack } from "expo-router";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { ThemedView } from "@/components/ThemedView";
import { t } from "@lingui/core/macro";
import { useAppTheme } from "@/theme";
import { useSocialListeners } from "../../hooks/useSocialListeners";
import { useSocialSyncOnStartup } from "../../hooks/useSocialSyncOnStartup";
import { useExerciseImageFiles } from "@/hooks/useExerciseImageFiles";
import { AppSnackbar } from "@/components/AppSnackbar";
import { StaleWorkoutPrompt } from "@/components/StaleWorkoutPrompt";
import { AccountOwnershipPrompt } from "@/components/AccountOwnershipPrompt";
import {
  setRestAlertOnSilent,
  setShowRestNotificationInForeground,
} from "@/utils/restNotification";
import { useEffect } from "react";
import { onboardingRedirect } from "@/utils/setupState";
import { SETTINGS_SCREENS } from "@/utils/settingsIndex";
import { useLingui } from "@lingui/react";

export default function AppLayout() {
  const { colors } = useAppTheme();
  const { _ } = useLingui();
  const { data: settings, isLoading: settingsLoading } = useSettingsQuery();
  useSocialListeners();
  useSocialSyncOnStartup();
  useExerciseImageFiles();

  const showRestInForeground = settings?.restTimerNotification === "true";
  useEffect(() => {
    setShowRestNotificationInForeground(showRestInForeground);
  }, [showRestInForeground]);
  const restAlertOnSilent = settings?.restAlertOnSilent === "true";
  useEffect(() => {
    setRestAlertOnSilent(restAlertOnSilent);
  }, [restAlertOnSilent]);

  if (settingsLoading) {
    return <ThemedView style={{ flex: 1 }}></ThemedView>;
  }

  // An onboarding gate, not an auth gate: a new install goes through welcome,
  // setup and an optional sign-in, and "Not now" passes it too.
  // Authentication is optional by design, so AuthContext can be null anywhere
  // under (app).
  const redirect = onboardingRedirect(settings);
  if (redirect) {
    return <Redirect href={redirect} />;
  }

  return (
    <>
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
          name="standalone-workout"
          options={{ title: t`Workout` }}
        />
        <Stack.Screen
          name="exercise-info"
          options={{ title: t`Exercise Info` }}
        />
        <Stack.Screen name="custom-exercise" />
        <Stack.Screen name="settings/index" options={{ title: t`Settings` }} />
        {SETTINGS_SCREENS.map((screen) => (
          <Stack.Screen
            key={screen.id}
            name={`settings/${screen.id}`}
            options={{ title: _(screen.title) }}
          />
        ))}
        <Stack.Screen name="plate-inventory" options={{ title: t`Plates` }} />
        <Stack.Screen
          name="delete-account"
          options={{ title: t`Delete Account` }}
        />
        <Stack.Screen name="help" options={{ title: t`Help & Info` }} />
        <Stack.Screen name="changelog" options={{ title: t`Changelog` }} />
        <Stack.Screen
          name="log-workout"
          options={{ title: t`Log past workout` }}
        />
        <Stack.Screen
          name="exercise-library"
          options={{ title: t`Exercise Library` }}
        />
        <Stack.Screen
          name="friend-profile"
          options={{ title: t`Friend Profile` }}
        />
        <Stack.Screen name="friend-plan" options={{ title: t`Plan Details` }} />
        <Stack.Screen
          name="friend-workout"
          options={{ title: t`Workout Details` }}
        />
        <Stack.Screen
          name="friend-exercise"
          options={{ title: t`Exercise Details` }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StaleWorkoutPrompt />
      <AccountOwnershipPrompt />
      <AppSnackbar />
    </>
  );
}
