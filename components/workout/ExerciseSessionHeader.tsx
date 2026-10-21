import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ActivityIndicator } from "react-native-paper";
import { AppImage } from "@/components/ui";
import { ThemedText } from "@/components/ThemedText";
import { formatFromTotalSeconds } from "@/utils/utility";
import { formatNumber } from "@/utils/numberFormat";
import { planDistanceToDisplay } from "@/utils/planDistance";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const fallbackImage = require("@/assets/images/placeholder.webp");

interface Props {
  exerciseId: number;
  exerciseName: string;
  animatedUrl: string | undefined;
  animatedImageLoading: boolean;
  animatedImageError: Error | null;
  trackingType: string;
  repsMin: number | undefined;
  repsMax: number | undefined;
  /** Target time in seconds. */
  timeMin: number | undefined;
  /** The plan's target distance, in metres. */
  distanceMin: number | undefined;
  distanceUnit: string;
  restMinutes: number;
  restSeconds: number;
  /** A smaller picture, for two headers stacked in a superset. */
  compact?: boolean;
}

/**
 * The exercise's picture (opens its details), name, target and rest, as the
 * focus screen and the list logging mode show it.
 */
export function ExerciseSessionHeader({
  exerciseId,
  exerciseName,
  animatedUrl,
  animatedImageLoading,
  animatedImageError,
  trackingType,
  repsMin,
  repsMax,
  timeMin,
  distanceMin: distanceMinMetres,
  distanceUnit,
  restMinutes,
  restSeconds,
  compact = false,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Shown only for a positive target, as text with the device separator.
  const distanceMin =
    distanceMinMetres != null && distanceMinMetres > 0
      ? formatNumber(planDistanceToDisplay(distanceMinMetres, distanceUnit), 2)
      : undefined;
  const repRange =
    repsMin === repsMax
      ? repsMin
      : !repsMin
        ? repsMax
        : repsMax
          ? `${repsMin} - ${repsMax}`
          : repsMin;

  const handleImagePress = () => {
    router.push({
      pathname: "/(app)/exercise-info",
      params: { exercise_id: exerciseId.toString() },
    });
  };
  const imageStyle = [styles.animatedImage, compact && styles.compactImage];

  return (
    <View style={styles.headerContent}>
      {animatedImageLoading ? (
        <ActivityIndicator size="small" color={colors.contentPrimary} />
      ) : (
        <TouchableOpacity
          onPress={handleImagePress}
          accessibilityRole="button"
          accessibilityLabel={t`Exercise details for ${exerciseName}`}
        >
          <AppImage
            style={imageStyle}
            source={
              !animatedImageError && animatedUrl
                ? { uri: animatedUrl }
                : fallbackImage
            }
          />
        </TouchableOpacity>
      )}
      <View style={styles.titleContainer}>
        {/* Long (often translated) names wrap, then shrink before the tail is cut. */}
        <ThemedText
          style={styles.title}
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          ellipsizeMode="tail"
          testID="session-exercise-name"
        >
          {exerciseName}
        </ThemedText>

        {trackingType !== "time" &&
          trackingType !== "distance" &&
          !!repRange && (
            <ThemedText style={styles.headerText}>
              <Trans>Reps: {repRange}</Trans>
            </ThemedText>
          )}
        {trackingType === "time" && !!timeMin && (
          <ThemedText style={styles.headerText}>
            <Trans>Time: {formatFromTotalSeconds(timeMin)}</Trans>
          </ThemedText>
        )}
        {trackingType === "distance" && !!distanceMin && (
          <ThemedText style={styles.headerText}>
            <Trans>
              Target: {distanceMin} {distanceUnit}
            </Trans>
          </ThemedText>
        )}

        <ThemedText style={styles.headerText}>
          <Trans>
            Rest Time: {restMinutes}:{String(restSeconds).padStart(2, "0")}
          </Trans>
        </ThemedText>
      </View>
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    headerContent: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    animatedImage: {
      width: 70,
      height: 70,
      borderRadius: radii.md,
      marginRight: 16,
    },
    compactImage: {
      width: 52,
      height: 52,
      marginRight: 12,
    },
    titleContainer: {
      flexShrink: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
    },
    headerText: {
      fontSize: 14,
      color: colors.contentSecondary,
      marginBottom: -5,
    },
  });
}
