import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBackupReminder } from "../useBackupReminder";
import { AuthContext } from "@/context/AuthProvider";
import { readLastBackupDate } from "@/utils/backup";
import { countCompletedWorkouts } from "@/utils/db/workoutStats";
import { useSettingsQuery } from "../useSettingsQuery";
import { useIsOnline } from "../useIsOnline";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useAccountOwnershipStore } from "@/store/accountOwnershipStore";

jest.mock("@/context/AuthProvider", () => {
  const { createContext } = require("react");
  return { AuthContext: createContext(null) };
});
jest.mock("@/utils/backup", () => ({ readLastBackupDate: jest.fn() }));
jest.mock("@/utils/db/workoutStats", () => ({
  countCompletedWorkouts: jest.fn(),
}));
jest.mock("../useSettingsQuery", () => ({ useSettingsQuery: jest.fn() }));
jest.mock("../useIsOnline", () => ({ useIsOnline: jest.fn(() => true) }));
const mockUpdateSetting = jest.fn();
jest.mock("../useUpdateSettingsMutation", () => ({
  useUpdateSettingsMutation: () => ({ mutate: mockUpdateSetting }),
}));
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));

const DAY = 24 * 60 * 60 * 1000;

const renderReminder = (user: { uid: string } | null) => {
  const queryClient = new QueryClient({
    // gcTime: Infinity schedules no garbage-collection timer, which would
    // otherwise keep Jest from exiting.
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={user as any}>
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return renderHook(() => useBackupReminder(), { wrapper });
};

describe("useBackupReminder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useIsOnline as jest.Mock).mockReturnValue(true);
    (useSettingsQuery as jest.Mock).mockReturnValue({ data: {} });
    (countCompletedWorkouts as jest.Mock).mockImplementation(
      async (since?: Date) => (since ? 4 : 20),
    );
    useActiveWorkoutStore.setState({ activeWorkout: null, workout: null });
    useAccountOwnershipStore.setState({
      resolvedFor: null,
      ownedByCurrentUser: false,
    });
  });

  // Backups are refused until the user decides whose data this is, so a
  // nudge to back up would only lead to an error.
  it("stays quiet while backups are paused for another account's data", async () => {
    (readLastBackupDate as jest.Mock).mockResolvedValue(null);
    useAccountOwnershipStore.setState({
      resolvedFor: "u1",
      ownedByCurrentUser: false,
    });
    const { result } = renderReminder({ uid: "u1" });

    await waitFor(() => expect(countCompletedWorkouts).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.reminder).toBeNull();
  });

  it("reminds a signed-out user with enough workouts, without touching the network", async () => {
    const { result } = renderReminder(null);

    await waitFor(() =>
      expect(result.current.reminder).toEqual({ reason: "signedOutNoBackup" }),
    );
    expect(readLastBackupDate).not.toHaveBeenCalled();
  });

  it("reminds a signed-in user who has never backed up", async () => {
    (readLastBackupDate as jest.Mock).mockResolvedValue(null);
    const { result } = renderReminder({ uid: "u1" });

    await waitFor(() =>
      expect(result.current.reminder).toEqual({ reason: "neverBackedUp" }),
    );
  });

  it("reports how stale the backup is and how many workouts came after it", async () => {
    const backupDate = new Date(Date.now() - 40 * DAY);
    (readLastBackupDate as jest.Mock).mockResolvedValue(backupDate);
    const { result } = renderReminder({ uid: "u1" });

    await waitFor(() =>
      expect(result.current.reminder).toEqual({
        reason: "stale",
        daysSinceBackup: 40,
        workoutsSinceBackup: 4,
      }),
    );
    expect(countCompletedWorkouts).toHaveBeenCalledWith(backupDate);
  });

  it("stays quiet when the backup date could not be read", async () => {
    (readLastBackupDate as jest.Mock).mockRejectedValue(new Error("offline"));
    const { result } = renderReminder({ uid: "u1" });

    await waitFor(() => expect(readLastBackupDate).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.reminder).toBeNull();
  });

  it("does not check for a backup while offline", async () => {
    (useIsOnline as jest.Mock).mockReturnValue(false);
    const { result } = renderReminder({ uid: "u1" });

    await waitFor(() => expect(countCompletedWorkouts).toHaveBeenCalled());
    expect(readLastBackupDate).not.toHaveBeenCalled();
    expect(result.current.reminder).toBeNull();
  });

  it("stays quiet while snoozed", async () => {
    (useSettingsQuery as jest.Mock).mockReturnValue({
      data: {
        backupReminderSnoozedUntil: new Date(Date.now() + DAY).toISOString(),
      },
    });
    const { result } = renderReminder(null);

    await waitFor(() => expect(countCompletedWorkouts).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.reminder).toBeNull();
  });

  it("stays quiet while a workout is in progress", async () => {
    useActiveWorkoutStore.setState({
      activeWorkout: { planId: 1, workoutId: 1, name: "Push" },
      workout: { id: 1, name: "Push", exercises: [] },
    });
    const { result } = renderReminder(null);

    await waitFor(() => expect(countCompletedWorkouts).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.reminder).toBeNull();
  });

  it("dismiss snoozes for 14 days and dismissForever far into the future", async () => {
    const { result } = renderReminder(null);

    act(() => result.current.dismiss());
    const later = mockUpdateSetting.mock.calls[0][0];
    expect(later.key).toBe("backupReminderSnoozedUntil");
    const days = (Date.parse(later.value) - Date.now()) / DAY;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);

    act(() => result.current.dismissForever());
    const never = mockUpdateSetting.mock.calls[1][0];
    expect(new Date(never.value).getUTCFullYear()).toBeGreaterThan(2100);
  });
});
