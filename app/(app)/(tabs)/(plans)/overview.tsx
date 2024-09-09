import {
  View,
  StyleSheet,
  Image,
  Button,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Colors } from "@/constants/Colors";
import { Workout } from "@/store/workoutStore";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Alert } from "react-native";
import { useDeletePlanMutation } from "@/hooks/useDeletePlanMutation";
import { useSetActivePlanMutation } from "@/hooks/useSetActivePlanMutation";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function PlanOverviewScreen() {
  const { planId } = useLocalSearchParams();
  const { data: plan, isLoading, error } = usePlanQuery(Number(planId));
  const deletePlanMutation = useDeletePlanMutation();
  const setActivePlanMutation = useSetActivePlanMutation();

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
        Alert.alert("Plan Started", "The plan has been started.");
      },
      onError: (error) => {
        Alert.alert("Error", `Failed to start plan: ${error.message}`);
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
              color={Colors.dark.icon}
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
        data={plan?.plan_data}
        renderItem={renderWorkoutCard}
        keyExtractor={(item: any, index: number) => index.toString()}
      />
      <View style={styles.buttonContainer}>
        <Button
          style={styles.button}
          title="Start Plan"
          onPress={handleStartPlan}
        />
        <Button
          style={styles.button}
          title="Edit Plan"
          onPress={() => router.push(`/(create-plan)/create?planId=${planId}`)}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors.dark.background,
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
    color: "#ECEFF4",
    marginTop: 10,
  },
  workoutCard: {
    backgroundColor: "#4C566A",
    padding: 16,
    marginBottom: 10,
    borderRadius: 8,
  },
  workoutTitle: {
    fontSize: 18,
    color: "#ECEFF4",
    fontWeight: "bold",
  },
  workoutInfo: {
    fontSize: 16,
    color: "#ECEFF4",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    width: 100,
  },
  activeBadge: {
    backgroundColor: "green",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    position: "absolute",
    top: 10,
    right: 10,
  },
  activeBadgeText: {
    color: "white",
    fontWeight: "bold",
  },
});
