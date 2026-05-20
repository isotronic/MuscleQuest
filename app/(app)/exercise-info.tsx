import {
  View,
  StyleSheet,
  ScrollView,
  SectionList,
  TouchableOpacity,
} from "react-native";
import { ActivityIndicator, IconButton, Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Colors } from "@/constants/Colors";
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
import { formatSetMetric } from "@/utils/formatSetMetric";
import Bugsnag from "@bugsnag/expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Notes } from "@/components/Notes";
import { useState } from "react";

const fallbackImage = require("@/assets/images/placeholder.webp");

type Tab = "info" | "history";

export default function ExerciseInfoScreen() {
  const { exercise_id } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("info");

  const {
    data: exerciseData,
    error: exerciseError,
    isLoading: exerciseLoading,
  } = useExerciseInfoQuery(Number(exercise_id));

  const { mutate: toggleFavorite } = useToggleFavoriteExerciseMutation();

  const { data: animatedUrl, isLoading: animatedImageLoading } =
    useAnimatedImageQuery(
      Number(exercise_id),
      exerciseData?.animated_url ?? "",
      exerciseData?.local_animated_uri,
    );

  const {
    data: historyData,
    isLoading: historyLoading,
    isError: historyError,
  } = useExerciseHistoryQuery(Number(exercise_id));

  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit ?? "kg";
  const bwUnitMultiplier = weightUnit === "lbs" ? 2.2046226 : 1;
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
          Error loading exercise details
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

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <>
              <Notes
                noteType="exercise"
                referenceId={exerciseData.exercise_id}
                buttonType="icon"
              />
              <IconButton
                icon={exerciseData.favorite ? "star" : "star-outline"}
                iconColor={
                  exerciseData.favorite ? Colors.dark.tint : Colors.dark.text
                }
                size={25}
                onPressIn={handleToggleFavorite}
              />
            </>
          ),
        }}
      />

      {/* Image — always visible above tabs */}
      <View style={styles.imageContainer}>
        {animatedImageLoading ? (
          <ActivityIndicator size="large" />
        ) : (
          <Image
            style={styles.image}
            source={animatedUrl ? { uri: animatedUrl } : fallbackImage}
          />
        )}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(["info", "history"] as Tab[]).map((tab) => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabPill, active && styles.tabPillActive]}
              activeOpacity={0.7}
            >
              <ThemedText
                style={[styles.tabLabel, active && styles.tabLabelActive]}
              >
                {tab === "info" ? "Info" : "History"}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab === "info" ? (
        <ScrollView contentContainerStyle={styles.infoContent}>
          <View style={styles.detailsContainer}>
            <ThemedText style={styles.title}>{exerciseData.name}</ThemedText>

            <View style={styles.infoRow}>
              <MaterialCommunityIcons
                name="target"
                size={20}
                style={styles.icon}
              />
              <ThemedText style={styles.infoText}>
                Target muscle: {exerciseData.target_muscle}
              </ThemedText>
            </View>

            {secondaryMuscles.length > 0 && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="plus"
                  size={20}
                  style={styles.icon}
                />
                <ThemedText style={styles.infoText}>
                  Secondary muscles: {secondaryMuscles.join(", ")}
                </ThemedText>
              </View>
            )}

            <View style={styles.infoRow}>
              <MaterialCommunityIcons
                name="dumbbell"
                size={20}
                style={styles.icon}
              />
              <ThemedText style={styles.infoText}>
                Equipment: {exerciseData.equipment}
              </ThemedText>
            </View>

            {!!exerciseData.is_unilateral && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="arm-flex"
                  size={20}
                  style={styles.icon}
                />
                <ThemedText style={styles.infoText}>
                  Single-arm / single-leg
                </ThemedText>
              </View>
            )}

            {!!exerciseData.double_weight && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name="scale-balance"
                  size={20}
                  style={styles.icon}
                />
                <ThemedText style={styles.infoText}>
                  Paired implements
                </ThemedText>
              </View>
            )}

            {description.length > 0 && (
              <View>
                <ThemedText style={styles.sectionTitle}>
                  Description:
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
                Edit Exercise
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
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionDate}>{section.date}</ThemedText>
              {section.workout_name ? (
                <ThemedText style={styles.sectionWorkout}>
                  {section.workout_name}
                </ThemedText>
              ) : null}
            </View>
          )}
          renderItem={({ item }: { item: HistorySet }) => (
            <View style={[styles.setRow, item.is_pr && styles.setRowPR]}>
              <View style={styles.setBadge}>
                <ThemedText style={styles.setBadgeText}>
                  Set {item.set_number}
                </ThemedText>
              </View>
              {item.is_pr && (
                <MaterialCommunityIcons
                  name="trophy"
                  size={14}
                  color={Colors.dark.tint}
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
                {formatSetMetric(
                  item,
                  trackingType,
                  weightUnit,
                  item.hist_bw_kg != null
                    ? item.hist_bw_kg * bwUnitMultiplier
                    : currentBodyWeight,
                )}
              </ThemedText>
            </View>
          )}
          ListEmptyComponent={
            historyLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" />
              </View>
            ) : historyError ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={48}
                  color={Colors.dark.subText}
                />
                <ThemedText style={styles.emptyText}>
                  Failed to load history
                </ThemedText>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="history"
                  size={48}
                  color={Colors.dark.subText}
                />
                <ThemedText style={styles.emptyText}>No history yet</ThemedText>
                <ThemedText style={styles.emptySubText}>
                  Completed sets will appear here
                </ThemedText>
              </View>
            )
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.screenBackground,
  },
  errorText: {
    color: Colors.dark.text,
  },
  imageContainer: {
    alignItems: "center",
    height: 350,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
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
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: Colors.dark.cardBackground,
  },
  tabPillActive: {
    backgroundColor: Colors.dark.tint + "25",
    borderWidth: 1,
    borderColor: Colors.dark.tint,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.subText,
  },
  tabLabelActive: {
    color: Colors.dark.tint,
  },
  // Info tab
  infoContent: {
    padding: 16,
    paddingBottom: 50,
    backgroundColor: Colors.dark.screenBackground,
  },
  detailsContainer: {
    padding: 16,
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 12,
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
    color: Colors.dark.text,
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
    backgroundColor: Colors.dark.screenBackground,
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
    color: Colors.dark.text,
  },
  sectionWorkout: {
    fontSize: 12,
    color: Colors.dark.subText,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: Colors.dark.cardBackground,
    gap: 8,
  },
  setRowPR: {
    backgroundColor: Colors.dark.tint + "18",
  },
  setBadge: {
    minWidth: 44,
  },
  setBadgeText: {
    fontSize: 12,
    color: Colors.dark.subText,
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
    color: Colors.dark.text,
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
    color: Colors.dark.subText,
  },
  emptySubText: {
    fontSize: 13,
    color: Colors.dark.subText,
    opacity: 0.7,
  },
});
