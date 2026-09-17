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
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { wasReported } from "@/utils/bugsnagDedup";
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
import { fetchSettings } from "@/utils/database";
import { runStartup, type StartupResult } from "@/utils/startup";
import { StartupRecoveryScreen } from "@/components/StartupRecoveryScreen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as googleServices from "@/google-services.json";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
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

BugsnagPerformance.start({
  plugins: [new BugsnagPluginReactNavigationNativePerformance()],
});

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

// Global safety net: report every query and mutation failure to Bugsnag, even
// from hooks that don't report in their own catch/onError. Errors already sent
// by a hook or helper are skipped (see utils/bugsnagDedup) to avoid duplicates.
const reportQueryError = (error: unknown) => {
  if (wasReported(error)) return;
  Bugsnag.notify(error instanceof Error ? error : new Error(String(error)));
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: reportQueryError }),
  // MutationCache.onError runs before each hook's own onError, so the hook's
  // notifyBugsnag would not have marked the error yet. onSettled runs after the
  // hook's onError has finished, so the dedup check sees it.
  mutationCache: new MutationCache({
    onSettled: (_data, error) => {
      if (error) reportQueryError(error);
    },
  }),
});

SplashScreen.preventAutoHideAsync().catch(() => {});

GoogleSignin.configure({
  webClientId: googleServices.client[0].oauth_client[2].client_id,
});

// Start App Check as early as possible (before any React render).
// The promise is awaited inside initializeDatabase so the app never mounts
// Firebase-dependent components until a Play Integrity / DeviceCheck token
// is in hand. Errors are swallowed so a failed attestation doesn't block startup.
const appCheckReady = setupAppCheck().catch((error) => {
  console.error(error);
  Bugsnag.notify(error);
});

function RootLayout() {
  // null while startup is still running (or the app is about to reload).
  const [startup, setStartup] = useState<StartupResult | null>(null);
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
    runStartup(appCheckReady)
      .then((result) => {
        if (result.status !== "reloading") setStartup(result);
      })
      .catch((e) => {
        const error = e instanceof Error ? e : new Error(String(e));
        Bugsnag.notify(error);
        setStartup({ status: "failed", error });
      });
  }, []);

  const isDatabaseInitialized = startup?.status === "ok";

  // Font loading errors are not fatal: React Native falls back to system fonts.
  useEffect(() => {
    if (error) {
      console.error("Font loading error:", error);
      Bugsnag.notify(error);
    }
  }, [error]);

  // Hide the splash once fonts have settled and startup has either succeeded
  // or failed, so neither a font error nor a failed init leaves it up forever.
  useEffect(() => {
    if ((loaded || error) && startup) {
      SplashScreen.hide();
    }
  }, [loaded, error, startup]);

  useEffect(() => {
    if (isDatabaseInitialized) {
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
    }
  }, [isDatabaseInitialized]);

  if (startup?.status === "failed") {
    return <StartupRecoveryScreen error={startup.error} />;
  }

  if (!isDatabaseInitialized) {
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
