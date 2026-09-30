import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import { BackupReminderCard } from "../BackupReminderCard";
import { useBackupReminder } from "@/hooks/useBackupReminder";
import { uploadDatabaseBackup } from "@/utils/backup";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
  Plural: ({ value, one, other }: any) =>
    String(value === 1 ? one : other).replace("#", String(value)),
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#fff",
      contentPrimary: "#000",
      contentSecondary: "#888",
      accent: "#f00",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
  };
});
jest.mock("@/components/ui", () => ({ AppIcon: () => null }));
jest.mock("react-native-paper", () => {
  const { View, Pressable, Text } = require("react-native");
  return {
    Button: ({ onPress, children, testID, disabled }: any) => (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
    ProgressBar: () => <View testID="backup-progress" />,
  };
});
jest.mock("@/hooks/useBackupReminder", () => ({
  useBackupReminder: jest.fn(),
}));
const mockSignIn = jest.fn();
let mockIsOnline = true;
jest.mock("@/hooks/useGoogleSignIn", () => ({
  useGoogleSignIn: () => ({
    signIn: mockSignIn,
    isSigningIn: false,
    isOnline: mockIsOnline,
  }),
}));
jest.mock("@/utils/backup", () => ({
  uploadDatabaseBackup: jest.fn(),
  classifyBackupError: jest.fn(() => "offline"),
}));
const mockInvalidateQueries = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));
const mockShowSnackbar = jest.fn();
jest.mock("@/store/snackbarStore", () => ({
  showSnackbar: (...args: unknown[]) => mockShowSnackbar(...args),
}));

const dismiss = jest.fn();
const dismissForever = jest.fn();
const showReminder = (reminder: object | null) =>
  (useBackupReminder as jest.Mock).mockReturnValue({
    reminder,
    dismiss,
    dismissForever,
  });

describe("BackupReminderCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
  });

  it("renders nothing without a reminder", () => {
    showReminder(null);
    const { toJSON } = render(<BackupReminderCard />);

    expect(toJSON()).toBeNull();
  });

  it("explains why a first backup matters", () => {
    showReminder({ reason: "neverBackedUp" });
    const { getByText, queryByTestId } = render(<BackupReminderCard />);

    expect(
      getByText(
        "Back up your training history. If you lose or replace your phone, a backup is the only way to get it back.",
      ),
    ).toBeTruthy();
    expect(queryByTestId("backup-reminder-never")).toBeNull();
    expect(queryByTestId("backup-reminder-sign-in")).toBeNull();
  });

  it("says how old the backup is and how much was logged since", () => {
    showReminder({
      reason: "stale",
      daysSinceBackup: 45,
      workoutsSinceBackup: 12,
    });
    const { getByText } = render(<BackupReminderCard />);

    expect(
      getByText(
        "Your last backup was 45 days ago. You've logged 12 workouts since.",
      ),
    ).toBeTruthy();
  });

  it("offers sign-in, Later and Don't remind me when signed out", () => {
    showReminder({ reason: "signedOutNoBackup" });
    const { getByText, getByTestId, queryByTestId } = render(
      <BackupReminderCard />,
    );

    expect(
      getByText(
        "Your workouts are only stored on this phone. Sign in to back them up.",
      ),
    ).toBeTruthy();
    expect(queryByTestId("backup-reminder-backup")).toBeNull();

    fireEvent.press(getByTestId("backup-reminder-sign-in"));
    expect(mockSignIn).toHaveBeenCalled();

    fireEvent.press(getByTestId("backup-reminder-never"));
    expect(dismissForever).toHaveBeenCalled();
  });

  it("Later dismisses the card", () => {
    showReminder({ reason: "neverBackedUp" });
    const { getByTestId } = render(<BackupReminderCard />);

    fireEvent.press(getByTestId("backup-reminder-later"));

    expect(dismiss).toHaveBeenCalled();
  });

  it("Back up now uploads in place and refreshes the backup date", async () => {
    (uploadDatabaseBackup as jest.Mock).mockResolvedValue(undefined);
    showReminder({ reason: "neverBackedUp" });
    const { getByTestId } = render(<BackupReminderCard />);

    await act(async () => {
      fireEvent.press(getByTestId("backup-reminder-backup"));
    });

    expect(uploadDatabaseBackup).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["lastBackupDate"],
    });
    expect(mockShowSnackbar).toHaveBeenCalledWith("Backup complete.");
  });

  it("shows progress while uploading and ignores a second press", async () => {
    (uploadDatabaseBackup as jest.Mock).mockImplementation(
      (_setProgress: unknown, setLoading: (v: boolean) => void) => {
        setLoading(true);
        return new Promise(() => {});
      },
    );
    showReminder({ reason: "neverBackedUp" });
    const { getByTestId } = render(<BackupReminderCard />);

    await act(async () => {
      fireEvent.press(getByTestId("backup-reminder-backup"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("backup-reminder-backup"));
    });

    expect(uploadDatabaseBackup).toHaveBeenCalledTimes(1);
    expect(getByTestId("backup-progress")).toBeTruthy();
  });

  it("explains a failed backup and keeps the card", async () => {
    (uploadDatabaseBackup as jest.Mock).mockRejectedValue(new Error("offline"));
    showReminder({ reason: "neverBackedUp" });
    const { getByTestId } = render(<BackupReminderCard />);

    await act(async () => {
      fireEvent.press(getByTestId("backup-reminder-backup"));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "Backup Failed",
      "You're offline. Connect to the internet and try again.",
    );
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("disables Back up now while offline", () => {
    mockIsOnline = false;
    showReminder({ reason: "neverBackedUp" });
    const { getByTestId } = render(<BackupReminderCard />);

    expect(
      getByTestId("backup-reminder-backup").props.accessibilityState.disabled,
    ).toBe(true);
  });
});
