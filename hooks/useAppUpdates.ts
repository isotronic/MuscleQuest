import { useState, useEffect, useCallback } from "react";
import * as Updates from "expo-updates";
import Bugsnag from "@bugsnag/expo";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "ready"
  | "error"
  | "no-update";

export interface UseAppUpdatesReturn {
  status: UpdateStatus;
  isUpdateReady: boolean;
  errorMessage: string | null;
  reloadApp: () => Promise<void>;
  dismissError: () => void;
}

export const useAppUpdates = (): UseAppUpdatesReturn => {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    // Skip update checks in development mode
    if (__DEV__) {
      // Treat "skipped in development" the same as "no update available"
      // so consumers can distinguish this from the initial "idle" state.
      setStatus("no-update");
      return;
    }

    // Skip if updates are not enabled (e.g., bare or non-managed builds)
    if (!Updates.isEnabled) {
      setStatus("no-update");
      return;
    }

    try {
      setStatus("checking");
      setErrorMessage(null);

      // Check if updates are available
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        // Update available, start downloading
        setStatus("downloading");

        await Updates.fetchUpdateAsync();

        // Download complete, ready to apply
        setStatus("ready");
      } else {
        // No update available
        setStatus("no-update");
      }
    } catch (error: unknown) {
      console.error("Error checking for updates:", error);
      Bugsnag.notify(error instanceof Error ? error : new Error(String(error)));
      const message =
        error instanceof Error ? error.message : "Failed to check for updates";
      setErrorMessage(message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  const reloadApp = async () => {
    try {
      await Updates.reloadAsync();
    } catch (error: unknown) {
      console.error("Error reloading app:", error);
      Bugsnag.notify(error instanceof Error ? error : new Error(String(error)));
      const message =
        error instanceof Error ? error.message : "Failed to reload app";
      setErrorMessage(message);
      setStatus("error");
    }
  };

  const dismissError = () => {
    setStatus("no-update");
    setErrorMessage(null);
  };

  return {
    status,
    isUpdateReady: status === "ready",
    errorMessage,
    reloadApp,
    dismissError,
  };
};
