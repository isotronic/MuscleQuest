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
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useWorkoutStore } from "@/store/workoutStore";
import {
  FAB,
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

type ScrollViewType = typeof ScrollView;

export default function CreatePlanScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { planId } = useLocalSearchParams();
  const [dataLoaded, setDataLoaded] = useState(!planId);
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<ScrollViewType>(null);
  const {
    workouts,
    planImageUrl,
    setPlanImageUrl,
    setWorkouts,
    clearWorkouts,
    addWorkout,
    removeWorkout,
    changeWorkoutName,
  } = useWorkoutStore();
  const { planName, setPlanName, planSaved, setPlanSaved, handleSavePlan } =
    useCreatePlan();
  const { data: existingPlan } = usePlanQuery(planId ? Number(planId) : null);

  useEffect(() => {
    if (existingPlan) {
      setPlanName(existingPlan.name);
      setPlanImageUrl(existingPlan.image_url);

      // Load workouts from the existing plan
      if (existingPlan.workouts) {
        setWorkouts(existingPlan.workouts);
      }

      setDataLoaded(true);
    }
  }, [existingPlan, setPlanName, setWorkouts, setPlanImageUrl]);

  // Listen for back navigation
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();

      if (planSaved) {
        queryClient.invalidateQueries({ queryKey: ["plans"] });
        queryClient.invalidateQueries({ queryKey: ["activePlan"] });
        clearWorkouts();
        setPlanSaved(false);
        return navigation.dispatch(e.data.action);
      }

      if (!workouts.length && !planName.trim()) {
        return navigation.dispatch(e.data.action);
      }

      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to discard them?",
        [
          { text: "Cancel", style: "cancel", onPress: () => {} },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              clearWorkouts();
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
    clearWorkouts,
    planSaved,
    setPlanSaved,
    queryClient,
  ]);

  const handleAddWorkout = () => {
    const newWorkout = { name: "", exercises: [] };
    addWorkout(newWorkout);

    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const handleRemoveWorkout = (index: number) => {
    Alert.alert(
      "Remove Workout",
      "Are you sure you want to remove this workout?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          onPress: () => removeWorkout(index),
          style: "destructive",
        },
      ],
      { cancelable: true },
    );
  };

  const handleImageSearch = () => {
    router.push(`/(app)/image-search`);
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

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["plans"] }),
        queryClient.invalidateQueries({ queryKey: ["activePlan"] }),
      ]);

      await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay for smooth UX

      if (newPlanId) {
        router.push("/(plans)");
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
              <ThemedText style={styles.loadingText}>Saving Plan...</ThemedText>
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
              onPress={handleSaveAndNavigate}
            >
              Save
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
                placeholder="Training Plan Name"
                value={planName}
                onChangeText={setPlanName}
                dense
              />
            </View>
            {workouts.length === 0 ? (
              <ThemedText style={styles.emptyText}>
                Tap + to add a workout to your plan
              </ThemedText>
            ) : (
              workouts.map((workout, index) => (
                <WorkoutCard
                  key={index}
                  workout={workout}
                  index={index}
                  onRemove={() => handleRemoveWorkout(index)}
                  onNameChange={changeWorkoutName}
                  onAddExercise={() => handleAddExercise(index)}
                />
              ))
            )}
          </ThemedView>
        )}
      </ScrollView>
      <FAB
        icon="plus"
        label="Add Workout"
        style={styles.fab}
        onPress={handleAddWorkout}
      />
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
    borderRadius: 10,
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
    borderRadius: 8,
    color: Colors.dark.text,
    fontSize: 18,
    lineHeight: 24,
    height: 45,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
  buttonLabel: {
    fontSize: 16,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
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
