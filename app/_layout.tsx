/**
 * MuscleQuest
 * Copyright (c) 2025 Joseph Bouqdib
 *
 * Licensed under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License.
 * You may not use, modify, distribute, or publish this software without explicit permission.
 * See the LICENSE file for more details.
 */

import Bugsnag from "@bugsnag/expo";
import React, { useEffect, useState } from "react";
import { Slot } from "expo-router";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import {
  ActivityIndicator,
  Button,
  Provider as PaperProvider,
} from "react-native-paper";
import { paperTheme } from "@/utils/paperTheme";
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
  insertDefaultSettings,
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
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

// Initialize Bugsnag
Bugsnag.start(process.env.EXPO_PUBLIC_BUGSNAG_API_KEY);

const ErrorBoundary = Bugsnag.getPlugin("react").createErrorBoundary(React);

const ErrorView = ({ clearError }: { clearError: () => void }) => {
  return (
    <ThemedView
      style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
    >
      <ThemedText>
        A render error has occurred. Press the button to reload.
      </ThemedText>
      <Button onPress={clearError} mode="contained">
        Reload
      </Button>
    </ThemedView>
  );
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

GoogleSignin.configure({
  webClientId: googleServices.client[0].oauth_client[1].client_id,
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
        // Set the database initialization state to true after setup is complete
        setIsDatabaseInitialized(true);
      } catch (error) {
        console.error("Database initialization error:", error);
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
      setupNotificationChannel();
      SplashScreen.hideAsync();
    }
  }, [loaded, error, isDatabaseInitialized, isInitializing]);

  if (isInitializing) {
    return (
      <ThemedView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" />
        <ThemedText>Loading data, please wait...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={DarkTheme}>
        <PaperProvider theme={paperTheme}>
          <AuthProvider>
            <SafeAreaProvider>
              <GestureHandlerRootView>
                <BottomSheetModalProvider>
                  <Slot screenOptions={{ headerShown: false }} />
                </BottomSheetModalProvider>
              </GestureHandlerRootView>
            </SafeAreaProvider>
          </AuthProvider>
        </PaperProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorView}>
      <RootLayout />
    </ErrorBoundary>
  );
}
