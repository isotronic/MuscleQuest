import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Colors } from "@/constants/Colors";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { useDeletePlanMutation } from "@/hooks/useDeletePlanMutation";
import { useSetActivePlanMutation } from "@/hooks/useSetActivePlanMutation";
import {
  Snackbar,
  Button,
  IconButton,
  Portal,
  Modal,
  ActivityIndicator,
} from "react-native-paper";
import { useState } from "react";
import Bugsnag from "@bugsnag/expo";
import { Notes } from "@/components/Notes";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function PlanOverviewScreen() {
  const { planId } = useLocalSearchParams();
  const { data: plan, isLoading, error } = usePlanQuery(Number(planId));
  const deletePlanMutation = useDeletePlanMutation();
  const setActivePlanMutation = useSetActivePlanMutation();

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarError, setSnackbarError] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const imageSource = plan?.image_url ? { uri: plan.image_url } : fallbackImage;

  const handleDeletePlan = () => {
    Alert.alert(
      "Delete Plan",
      "Are you sure you want to delete this plan?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deletePlanMutation.mutate(Number(planId), {
              onSuccess: () => {
                router.back(); // Navigate back after deletion
              },
              onError: (error) => {
                Alert.alert("Error", `Failed to delete plan: ${error.message}`);
                Bugsnag.notify(error);
              },
            });
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleStartPlan = () => {
    setActivePlanMutation.mutate(Number(planId), {
      onSuccess: () => {
        setSnackbarMessage("You activated this plan.");
        setSnackbarError(false);
        setSnackbarVisible(true);
      },
      onError: (error) => {
        setSnackbarMessage(`Failed to activate this plan: ${error.message}`);
        setSnackbarError(true);
        setSnackbarVisible(true);
        Bugsnag.notify(error);
      },
    });
  };

  if (isLoading) {
    return <ThemedText>Loading...</ThemedText>;
  }

  if (error) {
    return <ThemedText>Error: {error.message}</ThemedText>;
  }

  return (
    <ThemedView>
      {isEditing && (
        <Portal>
          <Modal visible={isEditing} dismissable={false}>
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <ThemedText style={styles.loadingText}>
                Loading Plan...
              </ThemedText>
            </View>
          </Modal>
        </Portal>
      )}
      {!plan?.app_plan_id && (
        <Stack.Screen
          options={{
            headerRight: () => (
              <>
                <Notes
                  noteType="plan"
                  referenceId={Number(planId)}
                  buttonType="icon"
                />
                <IconButton
                  icon="trash-can-outline"
                  size={25}
                  style={{ marginRight: 0 }}
                  iconColor={Colors.dark.highlight}
                  onPressIn={handleDeletePlan}
                />
              </>
            ),
          }}
        />
      )}
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.planHeader}>
          <Image source={imageSource} style={styles.planImage} />
          <ThemedText style={styles.planName}>{plan?.name}</ThemedText>
          {plan?.is_active === 1 && (
            <View style={styles.activeBadge}>
              <ThemedText style={styles.activeBadgeText}>Active</ThemedText>
            </View>
          )}
        </View>

        {plan?.workouts.map((workout, index) => (
          <TouchableOpacity
            key={index.toString()}
            onPress={() =>
              router.push(
                `/workout-details?planId=${planId}&workoutIndex=${index}`,
              )
            }
            style={styles.workoutCard}
          >
            <ThemedText style={styles.workoutTitle}>
              {workout.name || `Day ${index + 1}`}
            </ThemedText>
            <ThemedText style={styles.workoutInfo}>
              {workout.exercises.length} Exercises
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleStartPlan}
          style={styles.paperButton}
          labelStyle={styles.buttonLabel}
        >
          Start Plan
        </Button>
        <Button
          mode="outlined"
          onPress={async () => {
            if (isEditing) return; // Prevent multiple taps

            setIsEditing(true);

            try {
              await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay for UX
              router.push(`/(create-plan)/create?planId=${planId}`);
            } finally {
              setTimeout(() => setIsEditing(false), 500); // Prevent flickering
            }
          }}
          style={styles.paperButton}
          labelStyle={styles.buttonLabel}
          disabled={isEditing}
        >
          {plan?.app_plan_id ? "Customise" : "Edit"} Plan
        </Button>
      </View>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        style={{
          backgroundColor: snackbarError ? "red" : Colors.dark.completed,
        }}
        action={{
          label: "DISMISS",
          onPress: () => {
            setSnackbarVisible(false);
          },
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 50,
    paddingHorizontal: 16,
  },
  planHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  planImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
  },
  planName: {
    fontSize: 24,
    color: Colors.dark.text,
    marginTop: 10,
  },
  workoutCard: {
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
    marginBottom: 10,
    borderRadius: 8,
  },
  workoutTitle: {
    fontSize: 18,
    color: Colors.dark.text,
    fontWeight: "bold",
  },
  workoutInfo: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: Colors.dark.background,
  },
  paperButton: {
    flex: 1,
    marginRight: 10,
  },
  buttonLabel: {
    paddingVertical: 0,
  },
  activeBadge: {
    backgroundColor: Colors.dark.completed,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    position: "absolute",
    top: 10,
    right: 10,
  },
  activeBadgeText: {
    color: Colors.dark.text,
    fontWeight: "bold",
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
