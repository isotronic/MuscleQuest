import { t } from "@lingui/core/macro";

/** The body of the "Restore Backup" confirmation. */
export function restoreConfirmMessage(
  date: string | undefined,
  workoutInProgress: boolean,
): string {
  const replaces = date
    ? t`Restore backup from ${date}? This replaces all training data on this device. Anything logged since that backup will be lost.`
    : t`Restore your backup? This replaces all training data on this device. Anything logged since that backup will be lost.`;
  return workoutInProgress
    ? `${replaces} ${t`Your workout in progress will be discarded.`}`
    : replaces;
}
