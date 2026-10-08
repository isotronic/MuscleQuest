import { t } from "@lingui/core/macro";

/** The body of the "Restore Backup" confirmation. */
export function restoreConfirmMessage(
  backupDate: string | undefined,
  workoutInProgress: boolean,
): string {
  const replaces = backupDate
    ? t`Restore backup from ${backupDate}? This replaces all training data on this device. Anything logged since that backup will be lost.`
    : t`Restore your backup? This replaces all training data on this device. Anything logged since that backup will be lost.`;
  return workoutInProgress
    ? `${replaces} ${t`Your workout in progress will be discarded.`}`
    : replaces;
}
