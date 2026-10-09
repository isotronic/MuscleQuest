import { t } from "@lingui/core/macro";
import { classifyBackupError } from "./backup";

/** The message to show when a backup or restore fails. */
export const getBackupErrorMessage = (
  error: unknown,
  operation: "backup" | "restore",
) => {
  switch (classifyBackupError(error)) {
    case "account-mismatch":
      return t`The data on this device was used with another account. Choose to use it with this account before backing up.`;
    case "offline":
      return t`You're offline. Connect to the internet and try again.`;
    case "not-found":
      return t`No backup found for this account.`;
    case "integrity":
      return operation === "backup"
        ? t`Your data failed a safety check, so it was not uploaded. Your previous backup is unchanged.`
        : t`The backup is damaged and can't be restored. Your data on this device has not been changed.`;
    case "newer-schema":
      return t`This backup was made with a newer version of MuscleQuest. Update the app, then restore.`;
    default:
      return t`An unexpected error occurred.`;
  }
};
