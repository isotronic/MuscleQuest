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

export type UpdateErrorType = "download-failed" | "reload-failed";

export interface UseAppUpdatesReturn {
  status: UpdateStatus;
  errorType: UpdateErrorType | null;
  isUpdateReady: boolean;
  reloadApp: () => Promise<void>;
  dismissError: () => void;
}

export const useAppUpdates = (): UseAppUpdatesReturn => {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [errorType, setErrorType] = useState<UpdateErrorType | null>(null);

  const checkForUpdates = useCallback(async () => {
    // Skip update checks in development mode
    if (__DEV__) {
      setStatus("no-update");
      return;
    }

    // Skip if updates are not enabled (e.g., bare or non-managed builds)
    if (!Updates.isEnabled) {
      setStatus("no-update");
      return;
    }

    const attempt = async (isRetry: boolean): Promise<void> => {
      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          setStatus("downloading");
          try {
            await Updates.fetchUpdateAsync();
          } catch (error: unknown) {
            console.error("Error downloading update:", error);
            Bugsnag.notify(
              error instanceof Error ? error : new Error(String(error)),
            );
            setErrorType("download-failed");
            setStatus("error");
            return;
          }
          setStatus("ready");
        } else {
          setStatus("no-update");
        }
      } catch (error: unknown) {
        if (!isRetry) {
          // Wait 5 s and retry once before surfacing the error to the user
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return attempt(true);
        }

        console.error("Error checking for updates:", error);
        Bugsnag.notify(
          error instanceof Error ? error : new Error(String(error)),
        );
        setStatus("no-update");
      }
    };

    try {
      setStatus("checking");
      setErrorType(null);
      await attempt(false);
    } catch {
      // attempt() handles its own errors; this is a safety net
    }
  }, []);

  useEffect(() => {
    // Delay the first check to let the network stack initialize after cold start
    const timer = setTimeout(checkForUpdates, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  const reloadApp = async () => {
    try {
      await Updates.reloadAsync();
    } catch (error: unknown) {
      console.error("Error reloading app:", error);
      Bugsnag.notify(error instanceof Error ? error : new Error(String(error)));
      setErrorType("reload-failed");
      setStatus("error");
    }
  };

  const dismissError = () => {
    setStatus("no-update");
    setErrorType(null);
  };

  return {
    status,
    errorType,
    isUpdateReady: status === "ready",
    reloadApp,
    dismissError,
  };
};
