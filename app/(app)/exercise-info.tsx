import {
  View,
  StyleSheet,
  ScrollView,
  SectionList,
  TouchableOpacity,
} from "react-native";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { ActivityIndicator, Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useAnimatedImageQuery } from "@/hooks/useAnimatedImageQuery";
import { ThemedView } from "@/components/ThemedView";
import { useExerciseInfoQuery } from "@/hooks/useExerciseInfoQuery";
import { useToggleFavoriteExerciseMutation } from "@/hooks/useToggleFavoriteExerciseMutation";
import {
  useExerciseHistoryQuery,
  HistorySet,
  HistorySection,
} from "@/hooks/useExerciseHistoryQuery";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useIsExercisePinnedQuery } from "@/hooks/useIsExercisePinnedQuery";
import { usePinExerciseMutation } from "@/hooks/usePinExerciseMutation";
import { formatHistorySet } from "@/utils/exerciseProgressFormat";
import Bugsnag from "@bugsnag/expo";
import { AppIcon, AppImage, AppIconButton } from "@/components/ui";
import { Cues } from "@/components/Cues";
import { ExerciseProgressTab } from "@/components/exercise/ExerciseProgressTab";
import { useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import {
  muscleTranslations,
  equipmentTranslations,
} from "@/constants/dbTranslations";
import { displayWorkoutName } from "@/utils/workoutName";

const fallbackImage = require("@/assets/images/placeholder.webp");

type Tab = "progress" | "history" | "about";
const TABS: Tab[] = ["progress", "history", "about"];
const isTab = (value: unknown): value is Tab =>
  typeof value === "string" && (TABS as string[]).includes(value);

export default function ExerciseInfoScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { exercise_id, tab: tabParam } = useLocalSearchParams<{
    exercise_id: string;
    tab?: string;
  }>();
  const exerciseId = Number(exercise_id);
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);

  const {
    data: exerciseData,
    error: exerciseError,
    isLoading: exerciseLoading,
  } = useExerciseInfoQuery(exerciseId);

  const { mutate: toggleFavorite } = useToggleFavoriteExerciseMutation();
  const { data: isPinned = false } = useIsExercisePinnedQuery(exerciseId);
  const { mutate: setPinned, isPending: pinPending } = usePinExerciseMutation();

  const { data: animatedUrl, isLoading: animatedImageLoading } =
    useAnimatedImageQuery(
      exerciseId,
      exerciseData?.animated_url ?? "",
      exerciseData?.local_animated_uri,
    );

  const {
    data: historyData,
    isLoading: historyLoading,
    isError: historyError,
  } = useExerciseHistoryQuery(exerciseId);

  const { data: settings } = useSettingsQuery();
  const { _ } = useLingui();
  const weightUnit = settings?.weightUnit ?? "kg";
  const distanceUnit = settings?.distanceUnit ?? "m";
  // Fallback body weight in user's unit, used only when no historical measurement exists.
  const currentBodyWeight = Number(settings?.bodyWeight ?? 0);

  let secondaryMuscles: string[] = [];
  if (exerciseData?.secondary_muscles) {
    try {
      secondaryMuscles =
        typeof exerciseData.secondary_muscles === "string"
          ? JSON.parse(exerciseData.secondary_muscles)
          : exerciseData.secondary_muscles;
    } catch (error: any) {
      console.error("Error parsing secondary_muscles:", error);
      Bugsnag.notify(error);
      secondaryMuscles = [];
    }
  }

  let description: string[] = [];
  if (exerciseData?.description) {
    try {
      description =
        typeof exerciseData.description === "string"
          ? JSON.parse(exerciseData.description)
          : exerciseData.description;
    } catch (error: any) {
      console.error("Error parsing description:", error);
      Bugsnag.notify(error);
      description = [];
    }
  }

  if (exerciseLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (exerciseError || !exerciseData) {
    if (exerciseError) {
      Bugsnag.notify(exerciseError);
    }
    return (
      <View style={styles.centered}>
        <ThemedText style={styles.errorText}>
          <Trans>Error loading exercise details</Trans>
        </ThemedText>
      </View>
    );
  }

  const handleToggleFavorite = () => {
    toggleFavorite({
      exerciseId: exerciseData.exercise_id,
      currentStatus: exerciseData.favorite || 0,
    });
  };

  const trackingType = historyData?.trackingType ?? null;
  const sections = historyData?.sections ?? [];
  // An explicit choice wins, then the link's tab; otherwise Progress when
  // there is something to show and About when there is not.
  const activeTab: Tab | null =
    selectedTab ??
    (isTab(tabParam) ? tabParam : null) ??
    (historyLoading
      ? null
      : historyError || sections.length > 0
        ? "progress"
        : "about");
  const tabLabels: Record<Tab, string> = {
    progress: t`Progress`,
    history: t`History`,
    about: t`About`,
  };

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          title: exerciseData.name,
          headerRight: () => (
            <>
              <AppIconButton
                accessibilityLabel={
                  isPinned ? t`Unpin from Stats` : t`Pin to Stats`
                }
                accessibilityState={{ selected: isPinned }}
                icon={isPinned ? "pin" : "pin-outline"}
                iconColor={isPinned ? colors.accent : colors.contentPrimary}
                size={25}
                disabled={pinPending}
                onPress={() =>
                  setPinned({
                    exerciseId: exerciseData.exercise_id,
                    pinned: !isPinned,
                  })
                }
              />
              <Cues
                noteType="exercise"
                referenceId={exerciseData.exercise_id}
                buttonType="icon"
              />
              <AppIconButton
                accessibilityLabel={
                  exerciseData.favorite
                    ? t`Remove from favorites`
                    : t`Add to favorites`
                }
                icon={exerciseData.favorite ? "star" : "star-outline"}
                iconColor={
                  exerciseData.favorite ? colors.accent : colors.contentPrimary
                }
                size={25}
                onPressIn={handleToggleFavorite}
              />
            </>
          ),
        }}
      />

      {/* Tab bar */}
      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={tab}
              onPress={() => setSelectedTab(tab)}
              style={[styles.tabPill, active && styles.tabPillActive]}
              activeOpacity={0.7}
            >
              <ThemedText
                style={[styles.tabLabel, active && styles.tabLabelActive]}
              >
                {tabLabels[tab]}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab === null ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : activeTab === "progress" ? (
        <ExerciseProgressTab exerciseId={exerciseData.exercise_id} />
      ) : activeTab === "about" ? (
        <ScrollView contentContainerStyle={styles.infoContent}>
          <View style={styles.imageContainer}>
            {animatedImageLoading ? (
              <ActivityIndicator size="large" />
            ) : (
              <AppImage
                style={styles.image}
                source={animatedUrl ? { uri: animatedUrl } : fallbackImage}
              />
            )}
          </View>
          <View style={styles.detailsContainer}>
            <ThemedText style={styles.title}>{exerciseData.name}</ThemedText>

            <View style={styles.infoRow}>
              <AppIcon set="mci" name="target" size={20} style={styles.icon} />
              <ThemedText style={styles.infoText}>
                {t`Target muscle:`}{" "}
                {muscleTranslations[exerciseData.target_muscle]
                  ? _(muscleTranslations[exerciseData.target_muscle])
                  : exerciseData.target_muscle}
              </ThemedText>
            </View>

            {secondaryMuscles.length > 0 && (
              <View style={styles.infoRow}>
                <AppIcon set="mci" name="plus" size={20} style={styles.icon} />
                <ThemedText style={styles.infoText}>
                  {t`Secondary muscles:`}{" "}
                  {secondaryMuscles
                    .map((m) =>
                      muscleTranslations[m] ? _(muscleTranslations[m]) : m,
                    )
                    .join(", ")}
                </ThemedText>
              </View>
            )}

            <View style={styles.infoRow}>
              <AppIcon
                set="mci"
                name="dumbbell"
                size={20}
                style={styles.icon}
              />
              <ThemedText style={styles.infoText}>
                {t`Equipment:`}{" "}
                {equipmentTranslations[exerciseData.equipment]
                  ? _(equipmentTranslations[exerciseData.equipment])
                  : exerciseData.equipment}
              </ThemedText>
            </View>

            {!!exerciseData.is_unilateral && (
              <View style={styles.infoRow}>
                <AppIcon
                  set="mci"
                  name="arm-flex"
                  size={20}
                  style={styles.icon}
                />
                <ThemedText style={styles.infoText}>
                  <Trans>Single-arm / single-leg</Trans>
                </ThemedText>
              </View>
            )}

            {!!exerciseData.double_weight && (
              <View style={styles.infoRow}>
                <AppIcon
                  set="mci"
                  name="scale-balance"
                  size={20}
                  style={styles.icon}
                />
                <ThemedText style={styles.infoText}>
                  <Trans>Paired implements</Trans>
                </ThemedText>
              </View>
            )}

            {description.length > 0 && (
              <View>
                <ThemedText
                  accessibilityRole="header"
                  style={styles.sectionTitle}
                >
                  <Trans>Description:</Trans>
                </ThemedText>
                <ThemedText style={styles.descriptionText}>
                  {description.join("\n")}
                </ThemedText>
              </View>
            )}

            {exerciseData.app_exercise_id === null && (
              <Button
                mode="outlined"
                style={styles.editButton}
                labelStyle={styles.buttonLabel}
                onPress={() => {
                  router.push({
                    pathname: "/(app)/custom-exercise",
                    params: {
                      exercise_id: exerciseData.exercise_id.toString(),
                    },
                  });
                }}
              >
                <Trans>Edit Exercise</Trans>
              </Button>
            )}
          </View>
        </ScrollView>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item: HistorySet) => item.id.toString()}
          contentContainerStyle={[
            styles.historyContent,
            sections.length === 0 && styles.historyEmpty,
          ]}
          renderSectionHeader={({ section }: { section: HistorySection }) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityHint={t`Opens this workout`}
              style={styles.sectionHeader}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: "/(app)/(workout)/workout-summary",
                  params: { completedWorkoutId: String(section.workout_id) },
                })
              }
            >
              <ThemedText style={styles.sectionDate}>{section.date}</ThemedText>
              {section.workout_name ? (
                <ThemedText style={styles.sectionWorkout} numberOfLines={1}>
                  {displayWorkoutName(section.workout_name)}
                </ThemedText>
              ) : null}
              <AppIcon
                set="mci"
                name="chevron-right"
                size={18}
                color={colors.contentSecondary}
              />
            </TouchableOpacity>
          )}
          renderItem={({ item }: { item: HistorySet }) => (
            <View style={[styles.setRow, item.is_pr && styles.setRowPR]}>
              <View style={styles.setBadge}>
                <ThemedText style={styles.setBadgeText}>
                  <Trans>Set {item.set_number}</Trans>
                </ThemedText>
              </View>
              {item.is_pr && (
                <AppIcon
                  set="mci"
                  name="trophy"
                  size={14}
                  color={colors.accent}
                  style={styles.trophyIcon}
                />
              )}
              <ThemedText
                style={[
                  styles.metricText,
                  // @ts-ignore — fontVariant is valid RN style
                  { fontVariant: ["tabular-nums"] },
                ]}
              >
                {formatHistorySet(
                  item,
                  trackingType,
                  weightUnit,
                  distanceUnit,
                  currentBodyWeight,
                )}
              </ThemedText>
              {!!item.note?.trim() && (
                <ThemedText style={styles.setNote}>
                  {item.note.trim()}
                </ThemedText>
              )}
            </View>
          )}
          ListEmptyComponent={
            historyLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" />
              </View>
            ) : historyError ? (
              <View style={styles.emptyState}>
                <AppIcon
                  set="mci"
                  name="alert-circle-outline"
                  size={48}
                  color={colors.contentSecondary}
                />
                <ThemedText style={styles.emptyText}>
                  <Trans>Failed to load history</Trans>
                </ThemedText>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <AppIcon
                  set="mci"
                  name="history"
                  size={48}
                  color={colors.contentSecondary}
                />
                <ThemedText style={styles.emptyText}>
                  <Trans>No history yet</Trans>
                </ThemedText>
                <ThemedText style={styles.emptySubText}>
                  <Trans>Completed sets will appear here</Trans>
                </ThemedText>
              </View>
            )
          }
        />
      )}
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    errorText: {
      color: colors.contentPrimary,
    },
    imageContainer: {
      alignItems: "center",
      height: 350,
      marginBottom: 16,
    },
    image: {
      width: "100%",
      height: "100%",
      borderRadius: radii.lg,
    },
    tabBar: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    tabPill: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: radii.full,
      alignItems: "center",
      backgroundColor: colors.card,
    },
    tabPillActive: {
      backgroundColor: colors.accentSubtle,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.contentSecondary,
    },
    tabLabelActive: {
      color: colors.accent,
    },
    // About tab
    infoContent: {
      padding: 16,
      paddingBottom: 50,
      backgroundColor: colors.surface,
    },
    detailsContainer: {
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: radii.lg,
    },
    title: {
      fontSize: 22,
      fontWeight: "bold",
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    infoText: {
      fontSize: 16,
      marginHorizontal: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      marginTop: 16,
      marginBottom: 8,
    },
    descriptionText: {
      fontSize: 16,
      lineHeight: 24,
    },
    icon: {
      color: colors.contentPrimary,
    },
    editButton: {
      marginTop: 20,
    },
    buttonLabel: {
      fontSize: 16,
    },
    // History tab
    historyContent: {
      paddingHorizontal: 16,
      paddingBottom: 50,
      backgroundColor: colors.surface,
    },
    historyEmpty: {
      flexGrow: 1,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingTop: 16,
      paddingBottom: 6,
    },
    sectionDate: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.contentPrimary,
    },
    sectionWorkout: {
      flex: 1,
      fontSize: 12,
      color: colors.contentSecondary,
    },
    setRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      marginBottom: 4,
      backgroundColor: colors.card,
      gap: 8,
      flexWrap: "wrap",
    },
    setNote: {
      width: "100%",
      fontSize: 13,
      color: colors.contentSecondary,
    },
    setRowPR: {
      backgroundColor: colors.accentSubtle,
    },
    setBadge: {
      minWidth: 44,
    },
    setBadgeText: {
      fontSize: 12,
      color: colors.contentSecondary,
      fontWeight: "600",
    },
    trophyIcon: {
      marginRight: 2,
    },
    metricText: {
      flex: 1,
      textAlign: "right",
      fontSize: 15,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      gap: 8,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.contentSecondary,
    },
    emptySubText: {
      fontSize: 13,
      color: colors.contentSecondary,
      opacity: 0.7,
    },
  });
}
