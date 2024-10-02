import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { FAB } from "react-native-paper";
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
    return <ThemedText>Loading plans...</ThemedText>;
  }

  if (isError) {
    return <ThemedText>Error loading plans</ThemedText>;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <PlanList
          title="Your training plans"
          data={plans}
          onPressItem={handleViewPlan}
        />
        <PlanList title="Build muscle" data={[]} onPressItem={handleViewPlan} />
        <PlanList
          title="Gain strength"
          data={[]}
          onPressItem={handleViewPlan}
        />
        {/* <ThemedText style={{ margin: 20, textAlign: "center" }}>
          View all exercises
        </ThemedText> */}
      </ScrollView>
      <FAB
        icon="plus"
        label="Create plan"
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
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },
});
