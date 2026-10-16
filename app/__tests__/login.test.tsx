import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import { router } from "expo-router";
import LoginScreen from "../login";
import { updateSettings } from "@/utils/database";
import { readLastBackupDate, restoreDatabaseBackup } from "@/utils/backup";
import { showSnackbar } from "@/store/snackbarStore";
import { whenFilesSettled } from "@/utils/firstLaunchSeeding";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      background: "#000",
      card: "#111",
      contentPrimary: "#fff",
      contentSecondary: "#aaa",
      accent: "#0f0",
    },
  }),
}));
jest.mock("@/components/ThemedView", () => {
  const { View } = require("react-native");
  return { ThemedView: (props: any) => <View {...props} /> };
});
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/components/ui", () => ({ AppImage: () => null }));
jest.mock("@/assets/images/icon.png", () => 1);
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));

let mockParams: { onboarding?: string } = {};
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("react-native-paper", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ onPress, disabled, loading, children, testID }: any) => (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
    ProgressBar: () => null,
  };
});

// The hook's own tests cover double presses and the failure alerts.
const mockSignIn = jest.fn();
let mockSigningIn = false;
let mockIsOnline = true;
jest.mock("@/hooks/useGoogleSignIn", () => ({
  useGoogleSignIn: () => ({
    signIn: mockSignIn,
    isSigningIn: mockSigningIn,
    isOnline: mockIsOnline,
  }),
}));

jest.mock("@/utils/database", () => ({ updateSettings: jest.fn() }));
jest.mock("@/utils/backup", () => ({
  readLastBackupDate: jest.fn(),
  restoreDatabaseBackup: jest.fn(),
}));
jest.mock("@/utils/backupErrorMessage", () => ({
  getBackupErrorMessage: () => "Restore went wrong.",
}));
jest.mock("@/utils/restoreConfirmMessage", () => ({
  restoreConfirmMessage: () =>
    "This replaces all training data on this device.",
}));
jest.mock("@/store/snackbarStore", () => ({ showSnackbar: jest.fn() }));
jest.mock("@/utils/firstLaunchSeeding", () => ({
  whenFilesSettled: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/utils/bugsnagDedup", () => ({ notifyBugsnag: jest.fn() }));
jest.mock("@/hooks/useWhenSeeded", () => ({
  useWhenSeeded: () => ({
    run: async (action: () => unknown) => {
      await action();
    },
    retry: jest.fn(),
    waiting: false,
    failed: false,
  }),
}));
jest.mock("@/components/SeedingFailedNotice", () => ({
  SeedingFailedNotice: () => null,
}));

const press = async (getByTestId: (id: string) => any, id: string) => {
  await act(async () => {
    fireEvent.press(getByTestId(id));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockSigningIn = false;
  mockIsOnline = true;
  mockSignIn.mockReset();
  (updateSettings as jest.Mock).mockResolvedValue(undefined);
  (readLastBackupDate as jest.Mock).mockResolvedValue(null);
  (whenFilesSettled as jest.Mock).mockResolvedValue(undefined);
});

describe("LoginScreen", () => {
  it("disables both buttons while signing in", () => {
    mockSigningIn = true;
    const { getByTestId } = render(<LoginScreen />);

    expect(getByTestId("login-google").props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(getByTestId("login-skip").props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it("offers only Not now while offline", () => {
    mockIsOnline = false;
    const { queryByTestId, getByTestId, getByText } = render(<LoginScreen />);

    expect(queryByTestId("login-google")).toBeNull();
    expect(getByTestId("login-skip").props.accessibilityState.disabled).toBe(
      false,
    );
    expect(
      getByText(
        "Sign-in needs an internet connection. You can sign in later from Settings.",
      ),
    ).toBeTruthy();
  });

  it("stays on the screen when sign-in fails", async () => {
    mockSignIn.mockResolvedValue({ status: "error", reason: "unknown" });
    const { getByTestId } = render(<LoginScreen />);

    await press(getByTestId, "login-google");

    expect(router.replace).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe("LoginScreen in onboarding", () => {
  it("after setup, Not now goes to Get started", async () => {
    mockParams = { onboarding: "setup" };
    const { getByTestId } = render(<LoginScreen />);

    await press(getByTestId, "login-skip");

    expect(updateSettings).toHaveBeenCalledWith("loginShown", "true");
    expect(router.replace).toHaveBeenCalledWith("/get-started");
  });

  it("after setup, a sign-in with no backup goes to Get started", async () => {
    mockParams = { onboarding: "setup" };
    mockSignIn.mockResolvedValue({ status: "success" });
    const { getByTestId } = render(<LoginScreen />);

    await press(getByTestId, "login-google");

    expect(router.replace).toHaveBeenCalledWith("/get-started");
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it("from welcome, Not now continues into setup", async () => {
    mockParams = { onboarding: "returning" };
    const { getByTestId } = render(<LoginScreen />);

    await press(getByTestId, "login-skip");

    expect(updateSettings).toHaveBeenCalledWith("loginShown", "true");
    expect(router.replace).toHaveBeenCalledWith("/setup");
  });

  it("from welcome, a sign-in with no backup says so and continues into setup", async () => {
    mockParams = { onboarding: "returning" };
    mockSignIn.mockResolvedValue({ status: "success" });
    const { getByTestId } = render(<LoginScreen />);

    await press(getByTestId, "login-google");

    expect(showSnackbar).toHaveBeenCalledWith(
      "No backup found for this account.",
    );
    expect(router.replace).toHaveBeenCalledWith("/setup");
  });

  it("offers the backup when the account has one", async () => {
    mockParams = { onboarding: "returning" };
    mockSignIn.mockResolvedValue({ status: "success" });
    (readLastBackupDate as jest.Mock).mockResolvedValue(new Date(2026, 9, 12));
    const { getByTestId, getByText } = render(<LoginScreen />);

    await press(getByTestId, "login-google");

    expect(getByText("Welcome back")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("restores once first-launch work has settled", async () => {
    mockParams = { onboarding: "setup" };
    mockSignIn.mockResolvedValue({ status: "success" });
    (readLastBackupDate as jest.Mock).mockResolvedValue(new Date(2026, 9, 12));
    const order: string[] = [];
    (whenFilesSettled as jest.Mock).mockImplementation(async () => {
      order.push("settled");
    });
    (restoreDatabaseBackup as jest.Mock).mockImplementation(async () => {
      order.push("restore");
    });
    const { getByTestId } = render(<LoginScreen />);
    await press(getByTestId, "login-google");

    await press(getByTestId, "login-restore");

    expect(order).toEqual(["settled", "restore"]);
  });

  it("Start fresh continues as if there were no backup", async () => {
    mockParams = { onboarding: "setup" };
    mockSignIn.mockResolvedValue({ status: "success" });
    (readLastBackupDate as jest.Mock).mockResolvedValue(new Date(2026, 9, 12));
    const { getByTestId } = render(<LoginScreen />);
    await press(getByTestId, "login-google");

    await press(getByTestId, "login-start-fresh");

    expect(router.replace).toHaveBeenCalledWith("/get-started");
  });

  it("treats a failed backup check as no backup, without saying none was found", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockParams = { onboarding: "returning" };
    mockSignIn.mockResolvedValue({ status: "success" });
    (readLastBackupDate as jest.Mock).mockRejectedValue(new Error("offline"));
    const { getByTestId } = render(<LoginScreen />);

    await press(getByTestId, "login-google");

    expect(showSnackbar).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/setup");
  });

  it("keeps the restore offer after a failed restore", async () => {
    mockParams = { onboarding: "setup" };
    mockSignIn.mockResolvedValue({ status: "success" });
    (readLastBackupDate as jest.Mock).mockResolvedValue(new Date(2026, 9, 12));
    (restoreDatabaseBackup as jest.Mock).mockRejectedValue(new Error("x"));
    const { getByTestId } = render(<LoginScreen />);
    await press(getByTestId, "login-google");

    await press(getByTestId, "login-restore");

    expect(Alert.alert).toHaveBeenCalledWith(
      "Restore failed",
      "Restore went wrong.",
    );
    expect(getByTestId("login-start-fresh")).toBeTruthy();
  });
});

describe("LoginScreen outside onboarding", () => {
  it("Not now goes home", async () => {
    const { getByTestId } = render(<LoginScreen />);

    await press(getByTestId, "login-skip");

    expect(updateSettings).toHaveBeenCalledWith("loginShown", "true");
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("a sign-in does not look for a backup", async () => {
    mockSignIn.mockResolvedValue({ status: "success" });
    const { getByTestId } = render(<LoginScreen />);

    await press(getByTestId, "login-google");

    expect(readLastBackupDate).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
