import { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
} from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useWorkoutStore } from "@/store/workoutStore";
import {
  ActivityIndicator,
  Button,
  IconButton,
  Portal,
  Modal,
} from "react-native-paper";
import {
  useRouter,
  Stack,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { Colors } from "@/constants/Colors";
import { useCreatePlan } from "@/hooks/useCreatePlan";
import WorkoutCard from "@/components/WorkoutCard";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import { ImageBackground } from "expo-image";
import SaveIcon from "@/components/SaveIcon";
import PlanScheduleEditor from "@/components/PlanScheduleEditor";
import { fetchPlanSchedule } from "@/utils/database";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { radii } from "@/theme";

type ScrollViewType = typeof ScrollView;

export default function CreatePlanScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { planId } = useLocalSearchParams();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<ScrollViewType>(null);
  const {
    workouts,
    planImageUrl,
    setPlanImageUrl,
    setWorkouts,
    addWorkout,
    removeWorkout,
    reorderWorkouts,
    changeWorkoutName,
    planSchedule,
    setPlanSchedule,
    saveDraftEntry,
    clearDraftEntry,
    clearDraft,
  } = useWorkoutStore();

  const currentPlanId = planId ? Number(planId) : null;
  const draftKey =
    currentPlanId !== null ? `plan:${currentPlanId}` : "plan:null";
  const { data: settings } = useSettingsQuery();
  const weeklyGoal = Number(settings?.weeklyGoal ?? 3);
  const { planName, setPlanName, planSaved, setPlanSaved, handleSavePlan } =
    useCreatePlan();
  const { data: existingPlan } = usePlanQuery(planId ? Number(planId) : null);

  // 'pending' until draft check resolves; then 'continue' or 'fresh'
  const [draftDecision, setDraftDecision] = useState<
    "pending" | "continue" | "fresh"
  >("pending");

  // Check for a persisted draft once on mount, after store hydrates
  useEffect(() => {
    const checkDraft = () => {
      const { drafts } = useWorkoutStore.getState();
      const draft = drafts[draftKey];
      const hasDraft =
        !!draft &&
        (draft.workouts.length > 0 || (draft.draftName ?? "").trim() !== "");

      if (hasDraft) {
        Alert.alert(
          t`Continue Editing?`,
          t`You have unsaved changes from your last session. Would you like to continue?`,
          [
            {
              text: t`Discard Changes`,
              style: "destructive",
              onPress: () => {
                clearDraftEntry(draftKey);
                clearDraft();
                setDraftDecision("fresh");
                if (!planId) setDataLoaded(true);
              },
            },
            {
              text: t`Continue`,
              onPress: () => {
                setWorkouts(draft.workouts);
                if (draft.planImageUrl) setPlanImageUrl(draft.planImageUrl);
                if (draft.planSchedule) setPlanSchedule(draft.planSchedule);
                setPlanName(draft.draftName ?? "");
                setDraftDecision("continue");
                if (!planId) setDataLoaded(true);
              },
            },
          ],
        );
      } else {
        setDraftDecision("fresh");
        if (!planId) setDataLoaded(true);
      }
    };

    if (useWorkoutStore.persist.hasHydrated()) {
      checkDraft();
    } else {
      const unsub = useWorkoutStore.persist.onFinishHydration(checkDraft);
      return unsub;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft on every change so it survives app close
  useEffect(() => {
    if (draftDecision === "pending") return;
    if (workouts.length === 0 && !planName.trim()) return;
    saveDraftEntry(draftKey, {
      workouts,
      planImageUrl,
      planSchedule,
      draftName: planName,
    });
  }, [workouts, planImageUrl, planSchedule, planName, draftDecision]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draftDecision === "pending") return;
    if (draftDecision === "continue") {
      setDataLoaded(true);
      return;
    }
    if (!existingPlan) return;

    if (draftDecision === "fresh") {
      setPlanName(existingPlan.name);
      setPlanImageUrl(existingPlan.image_url);

      // Load workouts from the existing plan
      if (existingPlan.workouts) {
        setWorkouts(existingPlan.workouts);
      }

      // Load existing schedule and convert workout_id → array index
      let cancelled = false;
      if (existingPlan.id) {
        fetchPlanSchedule(existingPlan.id)
          .then((entries) => {
            if (cancelled) return;
            if (entries.length > 0 && existingPlan.workouts) {
              const schedule: Record<number, number> = {};
              for (const entry of entries) {
                const idx = existingPlan.workouts!.findIndex(
                  (w) => w.id === entry.workout_id,
                );
                if (idx !== -1) {
                  schedule[entry.day_of_week] = idx;
                }
              }
              setPlanSchedule(schedule);
            }
          })
          .catch((err) => {
            if (cancelled) return;
            Bugsnag.notify(err, (event) => {
              event.addMetadata("fetchPlanSchedule", {
                planId: existingPlan.id,
              });
            });
          });

        setDataLoaded(true);

        return () => {
          cancelled = true;
        };
      }
    }

    setDataLoaded(true);
  }, [
    existingPlan,
    draftDecision,
    setPlanName,
    setWorkouts,
    setPlanImageUrl,
    setPlanSchedule,
  ]);

  // Listen for back navigation
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();

      if (planSaved) {
        queryClient.invalidateQueries({ queryKey: ["plans"] });
        queryClient.invalidateQueries({ queryKey: ["activePlan"] });
        clearDraftEntry(draftKey);
        clearDraft();
        setPlanSaved(false);
        return navigation.dispatch(e.data.action);
      }

      if (!workouts.length && !planName.trim()) {
        clearDraftEntry(draftKey);
        clearDraft();
        return navigation.dispatch(e.data.action);
      }

      Alert.alert(
        t`Discard Changes?`,
        t`You have unsaved changes. Are you sure you want to discard them?`,
        [
          { text: t`Cancel`, style: "cancel", onPress: () => {} },
          {
            text: t`Discard`,
            style: "destructive",
            onPress: () => {
              clearDraftEntry(draftKey);
              clearDraft();
              setPlanSaved(false);
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });

    return unsubscribe;
  }, [
    navigation,
    workouts,
    planName,
    clearDraft,
    clearDraftEntry,
    draftKey,
    planSaved,
    setPlanSaved,
    queryClient,
  ]);

  const handleAddWorkout = () => {
    const newWorkout = { name: "", exercises: [], id: -Date.now() };
    addWorkout(newWorkout);

    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const handleRemoveWorkout = (index: number) => {
    Alert.alert(
      t`Remove Workout`,
      t`Are you sure you want to remove this workout?`,
      [
        {
          text: t`Cancel`,
          style: "cancel",
        },
        {
          text: t`Remove`,
          onPress: () => {
            removeWorkout(index);
          },
          style: "destructive",
        },
      ],
      { cancelable: true },
    );
  };

  const handleImageSearch = () => {
    router.push("/(app)/(create-plan)/image-search");
  };

  const handleAddExercise = (index: number) => {
    router.push(`/(app)/(create-plan)/exercises?index=${index}`);
  };

  const handleSaveAndNavigate = async () => {
    setIsSaving(true);

    try {
      const newPlanId = await handleSavePlan(
        Number(planId),
        existingPlan?.app_plan_id,
      );

      clearDraftEntry(draftKey);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["plans"] }),
        queryClient.invalidateQueries({ queryKey: ["activePlan"] }),
      ]);

      await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay for smooth UX

      if (newPlanId) {
        router.push("/(app)/(tabs)/(plans)");
      } else {
        router.back();
      }
    } catch (error: any) {
      console.error("Error in handleSaveAndNavigate:", error);
      Bugsnag.notify(error);
    } finally {
      setTimeout(() => setIsSaving(false), 500); // Prevent flickering
    }
  };

  const saveDisabled = !planName.trim() || workouts.length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.dark.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      {isSaving && (
        <Portal>
          <Modal visible={isSaving} dismissable={false}>
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <ThemedText style={styles.loadingText}>
                <Trans>Saving Plan...</Trans>
              </ThemedText>
            </View>
          </Modal>
        </Portal>
      )}
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              mode="text"
              icon={SaveIcon}
              style={{ marginRight: 0 }}
              disabled={saveDisabled || isSaving}
              onPressIn={handleSaveAndNavigate}
            >
              <Trans>Save</Trans>
            </Button>
          ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }}
      >
        {!dataLoaded ? (
          <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.text} />
          </ThemedView>
        ) : (
          <ThemedView style={styles.container}>
            <View style={styles.inputContainer}>
              <View style={styles.imageContainer}>
                <ImageBackground
                  source={{ uri: planImageUrl }}
                  style={styles.image}
                >
                  <IconButton
                    icon="pen"
                    size={20}
                    iconColor={Colors.dark.tint}
                    style={styles.overlayIcon}
                    onPress={handleImageSearch}
                  />
                </ImageBackground>
              </View>
              <TextInput
                style={styles.input}
                placeholderTextColor={Colors.dark.subText}
                placeholder={t`Training Plan Name`}
                value={planName}
                onChangeText={setPlanName}
                dense
              />
            </View>
            {workouts.length === 0 ? (
              <ThemedText style={styles.emptyText}>
                <Trans>Add a workout to get started</Trans>
              </ThemedText>
            ) : (
              workouts.map((workout, index) => (
                <WorkoutCard
                  key={workout.id ?? index}
                  workout={workout}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === workouts.length - 1}
                  onRemove={() => handleRemoveWorkout(index)}
                  onMoveUp={() => reorderWorkouts(index, index - 1)}
                  onMoveDown={() => reorderWorkouts(index, index + 1)}
                  onNameChange={changeWorkoutName}
                  onAddExercise={() => handleAddExercise(index)}
                />
              ))
            )}
            <Button
              mode="outlined"
              icon="plus"
              onPress={handleAddWorkout}
              style={styles.addWorkoutButton}
              labelStyle={styles.buttonLabel}
            >
              <Trans>Add Workout</Trans>
            </Button>
            <PlanScheduleEditor
              workouts={workouts}
              weeklyGoal={weeklyGoal}
              schedule={planSchedule}
              onChange={setPlanSchedule}
            />
          </ThemedView>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    overflow: "visible",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  imageContainer: {
    position: "relative",
    width: 60,
    height: 60,
    marginRight: 10,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: radii.md,
    overflow: "hidden",
  },
  overlayIcon: {
    position: "absolute",
    top: 5,
    right: 5,
  },
  input: {
    flex: 1,
    padding: 10,
    borderColor: Colors.dark.subText,
    borderWidth: 1,
    borderRadius: radii.md,
    color: Colors.dark.text,
    fontSize: 18,
    lineHeight: 24,
    height: 45,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
  addWorkoutButton: {
    marginTop: 16,
    borderRadius: radii.md,
  },
  buttonLabel: {
    fontSize: 16,
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)", // Dark transparent overlay
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: "white",
  },
});
