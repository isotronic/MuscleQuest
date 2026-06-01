/**
 * MuscleQuest
 * Copyright (c) 2025 Joseph Bouqdib
 *
 * Licensed under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License.
 * You may not use, modify, distribute, or publish this software without explicit permission.
 * See the LICENSE file for more details.
 */

// Intl.PluralRules polyfill required by Lingui for plural support in Hermes
import "@formatjs/intl-locale/polyfill-force.js";
import "@formatjs/intl-pluralrules/polyfill-force.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/de.js";
import "@formatjs/intl-pluralrules/locale-data/es.js";
import "@formatjs/intl-pluralrules/locale-data/fr.js";

import Bugsnag from "@bugsnag/expo";
import BugsnagPerformance from "@bugsnag/expo-performance";
import BugsnagPluginReactNavigationNativePerformance from "@bugsnag/plugin-react-navigation-performance";
import React, { useEffect, useState } from "react";
import { Slot, useNavigationContainerRef } from "expo-router";
import { ActivityIndicator, Button } from "react-native-paper";
import { AppThemeProvider } from "@/theme";
import { useFonts } from "expo-font";
import * as Updates from "expo-updates";
import "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Inter_100Thin,
  Inter_200ExtraLight,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from "@expo-google-fonts/inter";
import { AuthProvider } from "@/context/AuthProvider";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initializeAppData } from "@/utils/initAppDataDB";
import { initUserDataDB } from "@/utils/initUserDataDB";
import {
  copyDataFromAppDataToUserData,
  fetchSettings,
  insertDefaultSettings,
  syncExerciseFlagsFromAppData,
  updateAppExerciseIds,
} from "@/utils/database";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as googleServices from "@/google-services.json";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { loadPremadePlans } from "@/utils/loadPremadePlans";
import {
  getAsyncStorageItem,
  removeAsyncStorageItem,
} from "@/utils/asyncStorage";
import { setupNotificationChannel } from "@/utils/notificationSetup";
import { rescheduleWorkoutReminders } from "@/utils/workoutReminder";
import { setupAppCheck } from "@/utils/initAppCheck";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { I18nProvider } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { i18n } from "@/utils/i18n";

const manifest = Updates.manifest as
  | (Updates.Manifest & {
      metadata?: { updateGroup?: string };
    })
  | null;

const codeBundleId =
  manifest?.metadata?.updateGroup ?? Updates.updateId ?? undefined;

// Initialize Bugsnag
Bugsnag.start({
  apiKey: process.env.EXPO_PUBLIC_BUGSNAG_API_KEY,
  codeBundleId,
});

const bugsnagNavPlugin = new BugsnagPluginReactNavigationNativePerformance();
BugsnagPerformance.start({ plugins: [bugsnagNavPlugin] });

const ErrorBoundary = Bugsnag.getPlugin("react").createErrorBoundary(React);

const ErrorView = ({ clearError }: { clearError: () => void }) => {
  return (
    <ThemedView
      style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
    >
      <ThemedText>
        <Trans>A render error has occurred. Press the button to reload.</Trans>
      </ThemedText>
      <Button onPress={clearError} mode="contained">
        <Trans>Reload</Trans>
      </Button>
    </ThemedView>
  );
};

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch(() => {});

GoogleSignin.configure({
  webClientId: googleServices.client[0].oauth_client[1].client_id,
});

setupAppCheck().catch((error) => {
  console.error(error);
  Bugsnag.notify(error);
});

function RootLayout() {
  const [isDatabaseInitialized, setIsDatabaseInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [loaded, error] = useFonts({
    Inter_100Thin,
    Inter_200ExtraLight,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    BugsnagPerformance.getPlugin(
      BugsnagPluginReactNavigationNativePerformance,
    )?.registerNavigationContainerRef(navigationRef);
  }, [navigationRef]);

  useEffect(() => {
    async function initializeDatabase() {
      const databaseRestored = await getAsyncStorageItem("databaseRestored");
      console.log("Restore complete:", databaseRestored);
      if (databaseRestored === "true") {
        setIsDatabaseInitialized(true);
        setIsInitializing(false);
        return;
      }

      try {
        await initializeAppData();
        await initUserDataDB();
        await copyDataFromAppDataToUserData();
        await updateAppExerciseIds();
        await insertDefaultSettings();
        await loadPremadePlans();
        await syncExerciseFlagsFromAppData();
        // Set the database initialization state to true after setup is complete
        setIsDatabaseInitialized(true);
      } catch (error) {
        console.error("Database initialization error:", error);
        Bugsnag.notify(error as any);
        await Updates.reloadAsync();
      } finally {
        setIsInitializing(false);
      }
    }

    initializeDatabase();
    removeAsyncStorageItem("databaseRestored");
  }, []);

  useEffect(() => {
    if (loaded && !error && isDatabaseInitialized && !isInitializing) {
      setupNotificationChannel()
        .then(() => {
          fetchSettings()
            .then((s) => {
              rescheduleWorkoutReminders(
                s.workoutReminderEnabled ?? "false",
                s.workoutReminderDays ?? "[]",
                s.workoutReminderTime ?? "08:00",
              ).catch((err: any) => {
                Bugsnag.notify(err);
                console.error("Failed to reschedule workout reminders:", err);
              });
            })
            .catch((err: any) => {
              Bugsnag.notify(err);
              console.error(
                "Failed to fetch settings for workout reminders:",
                err,
              );
            });
        })
        .catch((err: any) => {
          Bugsnag.notify(err);
          console.error("Failed to setup notification channel:", err);
        });
      SplashScreen.hide();
    }
  }, [loaded, error, isDatabaseInitialized, isInitializing]);

  if (isInitializing) {
    return (
      <ThemedView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" />
        <ThemedText>
          <Trans>Loading data, please wait...</Trans>
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <GestureHandlerRootView>
              <BottomSheetModalProvider>
                <Slot />
              </BottomSheetModalProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </SafeAreaProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <I18nProvider i18n={i18n}>
      <ErrorBoundary FallbackComponent={ErrorView}>
        <RootLayout />
      </ErrorBoundary>
    </I18nProvider>
  );
}

export default BugsnagPerformance.withInstrumentedAppStarts(App);
