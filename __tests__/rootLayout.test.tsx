// Lives outside app/ because Expo Router would bundle any file under app/,
// including __tests__, as a route.
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { runStartup } from "@/utils/startup";

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    notify: jest.fn(),
    getPlugin: () => ({
      createErrorBoundary:
        () =>
        ({ children }: any) =>
          children,
    }),
  },
}));
jest.mock("@bugsnag/expo-performance", () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    getPlugin: jest.fn(),
    withInstrumentedAppStarts: (c: any) => c,
  },
}));
jest.mock("@bugsnag/plugin-react-navigation-performance", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@formatjs/intl-locale/polyfill-force.js", () => ({}));
jest.mock("@formatjs/intl-pluralrules/polyfill-force.js", () => ({}));
jest.mock("@formatjs/intl-pluralrules/locale-data/en.js", () => ({}));
jest.mock("@formatjs/intl-pluralrules/locale-data/de.js", () => ({}));
jest.mock("@formatjs/intl-pluralrules/locale-data/es.js", () => ({}));
jest.mock("@formatjs/intl-pluralrules/locale-data/fr.js", () => ({}));
jest.mock("react-native-reanimated", () => ({}));
jest.mock("expo-router", () => ({
  Slot: () => {
    const { Text } = require("react-native");
    return <Text>app-slot</Text>;
  },
  useNavigationContainerRef: () => ({}),
}));
jest.mock("expo-updates", () => ({
  manifest: null,
  updateId: null,
  reloadAsync: jest.fn(),
}));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hide: jest.fn(),
}));
jest.mock("expo-font", () => ({ useFonts: jest.fn() }));
jest.mock("@expo-google-fonts/inter", () => ({}));
jest.mock("@lingui/react", () => ({
  I18nProvider: ({ children }: any) => children,
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: any) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/utils/i18n", () => ({ i18n: {} }));
jest.mock("@/theme", () => ({
  AppThemeProvider: ({ children }: any) => children,
}));
jest.mock("@/context/AuthProvider", () => ({
  AuthProvider: ({ children }: any) => children,
}));
jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: ({ children }: any) => children,
}));
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModalProvider: ({ children }: any) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
}));
jest.mock("react-native-paper", () => ({
  ActivityIndicator: () => null,
  Button: () => null,
}));
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: { configure: jest.fn() },
}));
jest.mock("@/google-services.json", () => ({
  client: [{ oauth_client: [{}, {}, { client_id: "id" }] }],
}));
jest.mock("@/components/ThemedView", () => ({
  ThemedView: ({ children }: any) => children,
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/components/StartupRecoveryScreen", () => ({
  StartupRecoveryScreen: ({ error }: { error: Error }) => {
    const { Text } = require("react-native");
    return <Text>recovery: {error.message}</Text>;
  },
}));
jest.mock("@/utils/startup", () => ({ runStartup: jest.fn() }));
jest.mock("@/utils/initAppCheck", () => ({
  setupAppCheck: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/utils/database", () => ({
  fetchSettings: jest.fn(() => Promise.resolve({})),
}));
jest.mock("@/utils/notificationSetup", () => ({
  setupNotificationChannel: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/utils/workoutReminder", () => ({
  rescheduleWorkoutReminders: jest.fn(() => Promise.resolve()),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RootLayout = require("@/app/_layout").default;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  (useFonts as jest.Mock).mockReturnValue([true, null]);
  (runStartup as jest.Mock).mockResolvedValue({ status: "ok" });
});

describe("RootLayout", () => {
  it("renders the app after a successful startup", async () => {
    render(<RootLayout />);
    expect(await screen.findByText("app-slot")).toBeTruthy();
    expect(SplashScreen.hide).toHaveBeenCalled();
  });

  it("hides the splash when fonts fail to load", async () => {
    (useFonts as jest.Mock).mockReturnValue([false, new Error("font")]);
    render(<RootLayout />);
    await waitFor(() => expect(SplashScreen.hide).toHaveBeenCalled());
  });

  it("shows the recovery screen and hides the splash when startup fails", async () => {
    (runStartup as jest.Mock).mockResolvedValue({
      status: "failed",
      error: new Error("no such column"),
    });
    render(<RootLayout />);
    expect(
      await screen.findByText("recovery: no such column", { exact: false }),
    ).toBeTruthy();
    expect(screen.queryByText("app-slot")).toBeNull();
    expect(SplashScreen.hide).toHaveBeenCalled();
  });

  it("keeps the splash up while the app reloads", async () => {
    (runStartup as jest.Mock).mockResolvedValue({ status: "reloading" });
    render(<RootLayout />);
    await waitFor(() => expect(runStartup).toHaveBeenCalled());
    expect(SplashScreen.hide).not.toHaveBeenCalled();
    expect(screen.queryByText("app-slot")).toBeNull();
  });
});
