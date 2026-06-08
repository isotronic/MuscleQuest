import React, { useContext, useEffect, useState, useMemo } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Switch } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme } from "@/theme";
import { AuthContext } from "@/context/AuthProvider";
import { useSocialStore } from "@/store/socialStore";
import { usePrivacySettingsMutation } from "@/hooks/usePrivacySettingsMutation";
import {
  bulkPublishAllPlans,
  bulkPublishAllStandaloneWorkouts,
  bulkPublishAllCustomExercises,
  deleteAllSharedData,
} from "@/utils/sharing";
import Bugsnag from "@bugsnag/expo";
import type { FirestorePrivateSettings } from "@/types/firestore";
import type { AppThemeColors } from "@/theme/types";

interface Props {
  hideDeleteSection?: boolean;
}

export function PrivacySettings({ hideDeleteSection = false }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useContext(AuthContext);
  const { privacySettings } = useSocialStore();
  const { mutate: updatePrivacy } = usePrivacySettingsMutation();
  const [localPrivacySettings, setLocalPrivacySettings] =
    useState<FirestorePrivateSettings | null>(privacySettings);
  const [isDeletingSharedData, setIsDeletingSharedData] = useState(false);

  useEffect(() => {
    if (privacySettings) setLocalPrivacySettings(privacySettings);
  }, [privacySettings]);

  const handlePrivacyToggle = (patch: Partial<FirestorePrivateSettings>) => {
    if (!user) return;
    setLocalPrivacySettings((prev) => (prev ? { ...prev, ...patch } : prev));
    updatePrivacy(patch);
    if (patch.sharePlans === true) {
      bulkPublishAllPlans(user.uid).catch((err) => Bugsnag.notify(err));
    }
    if (patch.shareStandaloneWorkouts === true) {
      bulkPublishAllStandaloneWorkouts(user.uid).catch((err) =>
        Bugsnag.notify(err),
      );
    }
    if (patch.shareCustomExercises === true) {
      bulkPublishAllCustomExercises(user.uid).catch((err) =>
        Bugsnag.notify(err),
      );
    }
  };

  const handleDeleteAllSharedData = () => {
    if (!user) return;
    Alert.alert(
      t`Delete all shared data?`,
      t`This removes all content you have shared with friends. Your friends and friend list are not affected.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete`,
          style: "destructive",
          onPress: async () => {
            setIsDeletingSharedData(true);
            try {
              await deleteAllSharedData(user.uid);
              Alert.alert(t`Done`, t`All shared data has been removed.`);
            } catch (error: unknown) {
              Bugsnag.notify(
                error instanceof Error ? error : new Error(String(error)),
              );
            } finally {
              setIsDeletingSharedData(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionHeader}>
        <Trans>Privacy</Trans>
      </ThemedText>
      <ThemedText style={styles.rowSubtitle}>
        <Trans>
          Previously shared data always remains visible to your friends until
          you delete it below.
        </Trans>
      </ThemedText>

      {/* Share Plans */}
      <TouchableOpacity
        style={styles.item}
        onPress={() =>
          handlePrivacyToggle({
            sharePlans: !localPrivacySettings?.sharePlans,
          })
        }
      >
        <View style={styles.rowLeft}>
          <ThemedText style={styles.rowTitle}>
            <Trans>Share plans with friends</Trans>
          </ThemedText>
          {localPrivacySettings?.sharePlans ? (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>
                All plans are published and new ones are published
                automatically.
              </Trans>
            </ThemedText>
          ) : (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>
                Enable to publish all plans. Individual plans can still be
                toggled on the plan screen.
              </Trans>
            </ThemedText>
          )}
        </View>
        <Switch
          value={!!localPrivacySettings?.sharePlans}
          onValueChange={(v: boolean) => handlePrivacyToggle({ sharePlans: v })}
          color={colors.accent}
          style={styles.switch}
        />
      </TouchableOpacity>

      {/* Share Standalone Workouts */}
      <TouchableOpacity
        style={styles.item}
        onPress={() =>
          handlePrivacyToggle({
            shareStandaloneWorkouts:
              !localPrivacySettings?.shareStandaloneWorkouts,
          })
        }
      >
        <View style={styles.rowLeft}>
          <ThemedText style={styles.rowTitle}>
            <Trans>Share standalone workouts with friends</Trans>
          </ThemedText>
          {localPrivacySettings?.shareStandaloneWorkouts ? (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>
                All standalone workouts are published and new ones are published
                automatically.
              </Trans>
            </ThemedText>
          ) : (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>
                Enable to publish all standalone workouts. Individual workouts
                can still be toggled on the workout screen.
              </Trans>
            </ThemedText>
          )}
        </View>
        <Switch
          value={!!localPrivacySettings?.shareStandaloneWorkouts}
          onValueChange={(v: boolean) =>
            handlePrivacyToggle({ shareStandaloneWorkouts: v })
          }
          color={colors.accent}
          style={styles.switch}
        />
      </TouchableOpacity>

      {/* Share Custom Exercises */}
      <TouchableOpacity
        style={styles.item}
        onPress={() =>
          handlePrivacyToggle({
            shareCustomExercises: !localPrivacySettings?.shareCustomExercises,
          })
        }
      >
        <View style={styles.rowLeft}>
          <ThemedText style={styles.rowTitle}>
            <Trans>Share custom exercises with friends</Trans>
          </ThemedText>
          {localPrivacySettings?.shareCustomExercises ? (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>
                Custom exercises you create or edit are shared automatically.
              </Trans>
            </ThemedText>
          ) : (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>
                Enable to automatically share custom exercises you create or
                edit.
              </Trans>
            </ThemedText>
          )}
        </View>
        <Switch
          value={!!localPrivacySettings?.shareCustomExercises}
          onValueChange={(v: boolean) =>
            handlePrivacyToggle({ shareCustomExercises: v })
          }
          color={colors.accent}
          style={styles.switch}
        />
      </TouchableOpacity>

      {/* Share Completed Workouts */}
      <TouchableOpacity
        style={styles.item}
        onPress={() =>
          handlePrivacyToggle({
            shareCompletedWorkouts:
              !localPrivacySettings?.shareCompletedWorkouts,
          })
        }
      >
        <View style={styles.rowLeft}>
          <ThemedText style={styles.rowTitle}>
            <Trans>Share completed workouts with friends</Trans>
          </ThemedText>
          {localPrivacySettings?.shareCompletedWorkouts ? (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>Each workout you complete is shared automatically.</Trans>
            </ThemedText>
          ) : (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>
                Enable to automatically share each workout you complete.
              </Trans>
            </ThemedText>
          )}
        </View>
        <Switch
          value={!!localPrivacySettings?.shareCompletedWorkouts}
          onValueChange={(v: boolean) =>
            handlePrivacyToggle({ shareCompletedWorkouts: v })
          }
          color={colors.accent}
          style={styles.switch}
        />
      </TouchableOpacity>

      {/* Share Body Measurements */}
      <TouchableOpacity
        style={styles.item}
        onPress={() =>
          handlePrivacyToggle({
            shareBodyMeasurements: !localPrivacySettings?.shareBodyMeasurements,
          })
        }
      >
        <View style={styles.rowLeft}>
          <ThemedText style={styles.rowTitle}>
            <Trans>Share body measurements with friends</Trans>
          </ThemedText>
          {localPrivacySettings?.shareBodyMeasurements ? (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>
                Each measurement entry you record is shared automatically.
              </Trans>
            </ThemedText>
          ) : (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>
                Enable to automatically share each body measurement you record.
              </Trans>
            </ThemedText>
          )}
        </View>
        <Switch
          value={!!localPrivacySettings?.shareBodyMeasurements}
          onValueChange={(v: boolean) =>
            handlePrivacyToggle({ shareBodyMeasurements: v })
          }
          color={colors.accent}
          style={styles.switch}
        />
      </TouchableOpacity>

      {/* Share Strength PRs */}
      <TouchableOpacity
        style={styles.item}
        onPress={() =>
          handlePrivacyToggle({
            shareStrengthProgress: !localPrivacySettings?.shareStrengthProgress,
          })
        }
      >
        <View style={styles.rowLeft}>
          <ThemedText style={styles.rowTitle}>
            <Trans>Share strength PRs with friends</Trans>
          </ThemedText>
          {localPrivacySettings?.shareStrengthProgress ? (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>
                Strength PRs are shared automatically after each workout.
              </Trans>
            </ThemedText>
          ) : (
            <ThemedText style={styles.rowSubtitle}>
              <Trans>
                Enable to automatically share strength PRs after each workout.
              </Trans>
            </ThemedText>
          )}
        </View>
        <Switch
          value={!!localPrivacySettings?.shareStrengthProgress}
          onValueChange={(v: boolean) =>
            handlePrivacyToggle({ shareStrengthProgress: v })
          }
          color={colors.accent}
          style={styles.switch}
        />
      </TouchableOpacity>

      {/* Delete all shared data */}
      {!hideDeleteSection && (
        <TouchableOpacity
          style={[styles.item, { justifyContent: "center" }]}
          onPress={handleDeleteAllSharedData}
          disabled={isDeletingSharedData}
        >
          {isDeletingSharedData ? (
            <ActivityIndicator size="small" />
          ) : (
            <ThemedText style={{ color: colors.danger, fontWeight: "600" }}>
              <Trans>Delete all shared data</Trans>
            </ThemedText>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    section: {
      paddingTop: 16,
    },
    sectionHeader: {
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 8,
      color: colors.contentPrimary,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      justifyContent: "space-between",
    },
    rowLeft: {
      flex: 1,
      marginRight: 8,
    },
    rowTitle: {
      fontSize: 16,
      color: colors.contentPrimary,
    },
    rowSubtitle: {
      fontSize: 13,
      color: colors.contentSecondary,
      marginTop: 2,
    },
    switch: {
      marginLeft: "auto",
    },
  });
}
