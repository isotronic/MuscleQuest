import { useCallback, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthContext } from "@/context/AuthProvider";
import { readLastBackupDate } from "@/utils/backup";
import { countCompletedWorkouts } from "@/utils/db/workoutStats";
import { getBackupReminder, snoozeUntil } from "@/utils/backupReminder";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useAccountOwnershipStore } from "@/store/accountOwnershipStore";
import { useSettingsQuery } from "./useSettingsQuery";
import { useUpdateSettingsMutation } from "./useUpdateSettingsMutation";
import { useIsOnline } from "./useIsOnline";

const SNOOZE_SETTING = "backupReminderSnoozedUntil";
const HOUR_MS = 60 * 60 * 1000;

type LastBackup = { known: true; date: Date | null } | { known: false };

/**
 * Decides whether the home screen should nudge the user to back up (or to
 * sign in so they can). `dismiss` snoozes for two weeks; `dismissForever`
 * is "Don't remind me".
 */
export function useBackupReminder() {
  const user = useContext(AuthContext);
  const isOnline = useIsOnline();
  const { data: settings } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();
  const workoutInProgress = useActiveWorkoutStore((state) =>
    Boolean(state.activeWorkout && state.workout),
  );
  // Backups are refused while this account has not taken over the data.
  const backupsPaused = useAccountOwnershipStore(
    (s) => !!user && s.resolvedFor === user.uid && !s.ownedByCurrentUser,
  );

  // Keyed under completedWorkouts so saving or deleting a workout refetches.
  const { data: workoutCount } = useQuery({
    queryKey: ["completedWorkouts", "count"],
    queryFn: () => countCompletedWorkouts(),
    staleTime: 60_000,
  });

  // A network call, so cached for an hour. A failed check resolves to
  // "unknown" rather than throwing: being offline is not worth reporting, and
  // it must not read as "never backed up". Unknown is retried on next mount.
  const { data: lastBackup } = useQuery<LastBackup>({
    queryKey: ["lastBackupDate", user?.uid],
    queryFn: async () => {
      try {
        return { known: true, date: await readLastBackupDate() };
      } catch {
        return { known: false };
      }
    },
    enabled: !!user && isOnline,
    staleTime: (query) => (query.state.data?.known ? HOUR_MS : 0),
  });
  const backupDate = lastBackup?.known ? lastBackup.date : undefined;

  const { data: workoutsSinceBackup } = useQuery({
    queryKey: ["completedWorkouts", "count", backupDate?.toISOString()],
    queryFn: () => countCompletedWorkouts(backupDate!),
    enabled: backupDate != null,
    staleTime: 60_000,
  });

  const countsReady =
    workoutCount !== undefined &&
    (backupDate == null || workoutsSinceBackup !== undefined);

  const reminder =
    settings && countsReady && !backupsPaused
      ? getBackupReminder({
          isSignedIn: !!user,
          workoutCount,
          lastBackup:
            backupDate === undefined ? undefined : { date: backupDate },
          workoutsSinceBackup: workoutsSinceBackup ?? 0,
          snoozedUntil: settings.backupReminderSnoozedUntil,
          workoutInProgress,
        })
      : null;

  const dismiss = useCallback(
    () => updateSetting({ key: SNOOZE_SETTING, value: snoozeUntil("later") }),
    [updateSetting],
  );
  const dismissForever = useCallback(
    () => updateSetting({ key: SNOOZE_SETTING, value: snoozeUntil("never") }),
    [updateSetting],
  );

  return { reminder, dismiss, dismissForever };
}
