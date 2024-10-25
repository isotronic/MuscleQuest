import { Slot, useNavigationContainerRef } from "expo-router";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import {
  ActivityIndicator,
  Provider as PaperProvider,
} from "react-native-paper";
import { paperTheme } from "@/utils/paperTheme";
import { useFonts } from "expo-font";
import { isRunningInExpoGo } from "expo";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";
import { captureConsoleIntegration } from "@sentry/integrations";
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
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Constants from "expo-constants";

const IS_DEV = Constants.expoConfig?.extra?.appVariant === "development";

// Construct a new instrumentation instance. This is needed to communicate between the integration and React
const routingInstrumentation = new Sentry.ReactNavigationInstrumentation();

Sentry.init({
  dsn: "https://106113c86913cb234e3edd6e12387955@o4507527980974080.ingest.de.sentry.io/4507527986151504",
  debug: false, // If `true`, Sentry will try to print out useful debugging information if something goes wrong with sending the event. Set it to `false` in production
  integrations: [
    captureConsoleIntegration({ levels: ["log", "info", "warn", "error"] }),
    new Sentry.ReactNativeTracing({
      // Pass instrumentation to be used as `routingInstrumentation`
      routingInstrumentation,
      enableNativeFramesTracking: !isRunningInExpoGo(),
      // ...
    }),
  ],
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production.
  tracesSampleRate: 1.0,
  _experiments: {
    // profilesSampleRate is relative to tracesSampleRate.
    // Here, we'll capture profiles for 100% of transactions.
    profilesSampleRate: 1.0,
  },
  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // enableSpotlight: __DEV__,
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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

  // Capture the NavigationContainer ref and register it with the instrumentation.
  const ref = useNavigationContainerRef();

  useEffect(() => {
    if (ref) {
      routingInstrumentation.registerNavigationContainer(ref);
    }
  }, [ref]);

  useEffect(() => {
    async function initializeDatabase() {
      try {
        await initializeAppData();
        await initUserDataDB();
        await copyDataFromAppDataToUserData();
        await updateAppExerciseIds();
        await insertDefaultSettings();
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
  }, []);

  useEffect(() => {
    if (loaded && !error && isDatabaseInitialized && !isInitializing) {
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
                <Slot screenOptions={{ headerShown: false }} />
              </GestureHandlerRootView>
            </SafeAreaProvider>
          </AuthProvider>
        </PaperProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default IS_DEV ? RootLayout : Sentry.wrap(RootLayout);
