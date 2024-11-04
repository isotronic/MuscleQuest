import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { ActivityIndicator, FAB } from "react-native-paper";
import { useAllPlansQuery, Plan } from "@/hooks/useAllPlansQuery";
import { PlanList } from "@/components/PlanList";

export default function PlansScreen() {
  const { data: plans, isLoading, isError } = useAllPlansQuery();

  const handleCreatePlan = () => {
    router.push("/(app)/(create-plan)/create");
  };

  const handleViewPlan = (item: Plan) => {
    router.push(`/overview?planId=${item.id}`);
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  if (isError) {
    return <ThemedText>Error loading plans</ThemedText>;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <PlanList
          title="Your training plans"
          data={plans?.userPlans}
          onPressItem={handleViewPlan}
        />
        <PlanList
          title="Premade plans"
          data={plans?.appPlans}
          onPressItem={handleViewPlan}
        />
        {/* <ThemedText style={{ margin: 20, textAlign: "center" }}>
          View all exercises
        </ThemedText> */}
      </ScrollView>
      <FAB
        icon="plus"
        label="Create Plan"
        theme={{ colors: { primary: Colors.dark.tint } }}
        style={styles.fab}
        onPress={() => {
          handleCreatePlan();
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },
});
