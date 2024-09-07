import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { FAB } from "react-native-paper";
import { usePlans } from "@/hooks/usePlans";
import { PlanList } from "@/components/PlanList";

export interface TrainingPlan {
  plan_data: object;
  name: string;
  image_url: string;
}

export default function PlansScreen() {
  const plans = usePlans();

  const handleCreatePlan = () => {
    router.push("/(app)/(create-plan)/create");
  };

  // const handleEditPlan = () => {
  //   router.push("/(app)/(create-plan)/edit");
  // };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <PlanList
          title="Your training plans"
          data={plans}
          onPressItem={() => {}}
        />
        <PlanList
          title="Build muscle"
          data={[1, 2, 3, 4, 5, 6]}
          onPressItem={() => {}}
        />
        <PlanList
          title="Gain strength"
          data={[1, 2, 3, 4, 5, 6]}
          onPressItem={() => {}}
        />
        <ThemedText style={{ margin: 20, textAlign: "center" }}>
          View all exercises
        </ThemedText>
      </ScrollView>
      <FAB
        icon="plus"
        label="Create plan"
        rippleColor={Colors.dark.tint}
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
