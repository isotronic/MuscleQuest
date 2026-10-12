import { useContext, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, ProgressBar, Switch } from "react-native-paper";
import { useQueryClient } from "@tanstack/react-query";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import {
  SettingRow,
  SettingsScroll,
  useSettingStyles,
} from "@/components/settings/SettingRow";
import { AuthContext } from "@/context/AuthProvider";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { useImageManagement } from "@/hooks/useImageManagement";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useTrainingDataExport } from "@/hooks/useTrainingDataExport";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { showSnackbar } from "@/store/snackbarStore";
import { useAppTheme } from "@/theme";
import { claimLocalData } from "@/utils/accountOwnership";
import {
  classifyBackupError,
  fetchLastBackupDate,
  restoreDatabaseBackup,
  uploadDatabaseBackup,
} from "@/utils/backup";
import { getBackupErrorMessage } from "@/utils/backupErrorMessage";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { restoreConfirmMessage } from "@/utils/restoreConfirmMessage";

export default function DataSettingsScreen() {
  const { colors } = useAppTheme();
  const styles = useSettingStyles();
  const user = useContext(AuthContext);
  const { isOnline } = useGoogleSignIn();
  const queryClient = useQueryClient();
  const { data: settings } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();
  const { isExporting, promptExport } = useTrainingDataExport();
  const {
    isToggled: isDownloadToggled,
    isDownloading,
    isDeleting,
    progress,
    toggleDownloadImages,
  } = useImageManagement(updateSetting, settings?.downloadImages);

  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isRestoreLoading, setIsRestoreLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState(1);
  const [restoreProgress, setRestoreProgress] = useState(1);

  const [lastBackupDate, setLastBackupDate] = useState<Date | null>(null);
  const [isLoadingBackupDate, setIsLoadingBackupDate] = useState(false);

  useEffect(() => {
    const getBackupDate = async () => {
      if (user) {
        setIsLoadingBackupDate(true);
        const date = await fetchLastBackupDate();
        setLastBackupDate(date);
        setIsLoadingBackupDate(false);
      }
    };

    getBackupDate();
  }, [isBackupLoading, user]);

  const isBackupBusy = isBackupLoading || isRestoreLoading;

  const handleBackup = async () => {
    if (isBackupBusy) return;
    try {
      await uploadDatabaseBackup(setBackupProgress, setIsBackupLoading);
      // The home backup reminder caches this for an hour.
      queryClient.invalidateQueries({ queryKey: ["lastBackupDate"] });
      showSnackbar(t`Backup complete.`);
    } catch (error) {
      if (classifyBackupError(error) === "account-mismatch" && user) {
        const uid = user.uid;
        Alert.alert(t`Backup Failed`, getBackupErrorMessage(error, "backup"), [
          { text: t`Not now`, style: "cancel" },
          {
            text: t`Use with this account`,
            onPress: () => {
              claimLocalData(uid).catch((claimError) => {
                notifyBugsnag(claimError);
                showSnackbar(t`Couldn't save your choice. Try again.`);
              });
            },
          },
        ]);
        return;
      }
      Alert.alert(t`Backup Failed`, getBackupErrorMessage(error, "backup"));
    }
  };

  const handleRestore = async () => {
    if (isBackupBusy) return;
    try {
      await restoreDatabaseBackup(
        setRestoreProgress,
        setIsRestoreLoading,
        queryClient,
      );
    } catch (error) {
      Alert.alert(t`Restore Failed`, getBackupErrorMessage(error, "restore"));
    }
  };

  const confirmRestoreBackup = () => {
    const date = lastBackupDate?.toLocaleDateString();
    Alert.alert(
      t`Restore Backup`,
      restoreConfirmMessage(
        date,
        useActiveWorkoutStore.getState().isWorkoutInProgress(),
      ),
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Restore`,
          style: "destructive",
          onPress: handleRestore,
        },
      ],
    );
  };

  return (
    <SettingsScroll>
      <SettingRow
        id="backup"
        icon="cloud-upload"
        title={<Trans>Backup and restore</Trans>}
        value={
          !user
            ? t`You need to sign in to use this feature`
            : !isOnline
              ? t`Backup needs an internet connection.`
              : isLoadingBackupDate
                ? t`Checking for backups...`
                : lastBackupDate
                  ? t`Last backup: ${lastBackupDate.toLocaleDateString()}`
                  : t`No backups found`
        }
        trailing={
          user && (
            <>
              <Button
                style={local.backupButton}
                mode="outlined"
                compact
                disabled={isBackupBusy || !isOnline}
                onPress={handleBackup}
              >
                <Trans>Backup</Trans>
              </Button>
              <Button
                mode="outlined"
                compact
                disabled={isBackupBusy || !isOnline}
                onPress={confirmRestoreBackup}
              >
                <Trans>Restore</Trans>
              </Button>
            </>
          )
        }
      />
      {(isBackupLoading || isRestoreLoading) && (
        <View style={styles.progressContainer}>
          <ThemedText style={styles.progressText}>
            {isBackupLoading
              ? t`Uploading. Please wait...`
              : t`Restoring. Please wait...`}
          </ThemedText>
          <ProgressBar
            animatedValue={
              isBackupLoading ? backupProgress / 100 : restoreProgress / 100
            }
            color={colors.accent}
          />
        </View>
      )}
      <SettingRow
        id="export"
        icon="file-export"
        title={<Trans>Export training data</Trans>}
        value={
          isExporting
            ? t`Exporting...`
            : t`Save your workouts and measurements as CSV or JSON`
        }
        onPress={promptExport}
        disabled={isExporting}
      />
      <SettingRow
        id="downloadImages"
        icon="cloud-download"
        title={<Trans>Download all exercise animations</Trans>}
        value={
          isOnline || isDownloadToggled === "true" ? (
            <Trans>Size: ~100MB</Trans>
          ) : (
            <Trans>Downloading needs an internet connection.</Trans>
          )
        }
        trailing={
          <Switch
            accessibilityLabel={t`Download all exercise animations`}
            value={isDownloadToggled === "true"}
            onValueChange={toggleDownloadImages}
            // Turning it off only deletes local files, which works offline.
            disabled={!isOnline && isDownloadToggled !== "true"}
            color={colors.accent}
            style={styles.switch}
          />
        }
      />
      {(isDownloading || isDeleting) && (
        <View style={styles.progressContainer}>
          <ThemedText style={styles.progressText}>
            {isDownloading
              ? t`Downloading. Please wait...`
              : t`Deleting. Please wait...`}
          </ThemedText>
          <ProgressBar
            animatedValue={progress}
            color={isDownloading ? colors.accent : colors.danger}
          />
        </View>
      )}
    </SettingsScroll>
  );
}

const local = StyleSheet.create({
  backupButton: { marginRight: 4 },
});
