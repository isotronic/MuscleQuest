import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Colors } from "@/constants/Colors";
import { Workout } from "@/store/workoutStore";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useDeletePlanMutation } from "@/hooks/useDeletePlanMutation";
import { useSetActivePlanMutation } from "@/hooks/useSetActivePlanMutation";
import { Snackbar, Button } from "react-native-paper";
import { useState } from "react";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function PlanOverviewScreen() {
  const { planId } = useLocalSearchParams();
  const { data: plan, isLoading, error } = usePlanQuery(Number(planId));
  const deletePlanMutation = useDeletePlanMutation();
  const setActivePlanMutation = useSetActivePlanMutation();

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarError, setSnackbarError] = useState(false);

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
      },
    });
  };

  const renderWorkoutCard = ({
    item,
    index,
  }: {
    item: Workout;
    index: number;
  }) => (
    <TouchableOpacity
      onPress={() =>
        router.push(`/workout-details?planId=${planId}&workoutIndex=${index}`)
      }
      style={styles.workoutCard}
    >
      <ThemedText style={styles.workoutTitle}>
        {item.name || `Day ${index + 1}`}
      </ThemedText>
      <ThemedText style={styles.workoutInfo}>
        {item.exercises.length} Exercises
      </ThemedText>
    </TouchableOpacity>
  );

  if (isLoading) {
    return <ThemedText>Loading...</ThemedText>;
  }

  if (error) {
    return <ThemedText>Error: {error.message}</ThemedText>;
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={24}
              color={Colors.dark.highlight}
              onPress={handleDeletePlan}
            />
          ),
        }}
      />
      <View style={styles.planHeader}>
        <Image source={imageSource} style={styles.planImage} />
        <ThemedText style={styles.planName}>{plan?.name}</ThemedText>
        {plan?.is_active === 1 && (
          <View style={styles.activeBadge}>
            <ThemedText style={styles.activeBadgeText}>Active</ThemedText>
          </View>
        )}
      </View>

      <FlatList
        data={plan?.workouts}
        renderItem={renderWorkoutCard}
        keyExtractor={(item: any, index: number) => index.toString()}
      />

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
          onPress={() => router.push(`/(create-plan)/create?planId=${planId}`)}
          style={styles.paperButton}
          labelStyle={styles.buttonLabel}
        >
          Edit Plan
        </Button>
      </View>

      <View style={styles.snackBarContainer}>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={2000}
          style={{ backgroundColor: snackbarError ? "red" : "green" }}
          action={{
            label: "DISMISS",
            onPress: () => {
              setSnackbarVisible(false);
            },
          }}
        >
          {snackbarMessage}
        </Snackbar>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
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
    marginTop: 20,
  },
  paperButton: {
    flex: 1,
    marginRight: 10,
  },
  buttonLabel: {
    fontSize: 16,
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
  snackBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});
