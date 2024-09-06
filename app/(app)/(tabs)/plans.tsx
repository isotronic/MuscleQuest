import { useCallback, useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import TrainingPlanCard from "@/components/TrainingPlanCard";
import { Colors } from "@/constants/Colors";
import { router } from "expo-router";
import { FlatList, ScrollView, StyleSheet } from "react-native";
import { FAB } from "react-native-paper";
import { fetchAllRecords } from "@/utils/database";
import { Workout } from "@/store/store";
import { useFocusEffect } from "@react-navigation/native";

interface TrainingPlan {
  plan_data: object;
  name: string;
  image_url: string;
}

export default function PlansScreen() {
  const [plans, setPlans] = useState<Workout[]>([]);

  const fetchPlans = async () => {
    try {
      const plans = (await fetchAllRecords(
        "userData.db",
        "user_plans",
      )) as Workout[];
      setPlans(plans);
    } catch (error) {
      console.error("Error fetching plans", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPlans();
    }, []),
  );

  const handleCreatePlan = () => {
    router.push("/(app)/(create-plan)/create");
  };

  // const handleEditPlan = () => {
  //   router.push("/(app)/(create-plan)/edit");
  // };

  const renderTrainingPlanCard = ({ item }: { item: TrainingPlan }) => {
    // const planData = JSON.stringify(item.plan_data);
    return (
      <TrainingPlanCard
        title={item.name}
        imageUrl={item.image_url}
        onPress={() => {}}
      />
    );
  };
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <ThemedText style={styles.sectionTitle}>Your training plans</ThemedText>
        {plans.length === 0 && (
          <ThemedText style={styles.noPlansText}>
            No training plans found
          </ThemedText>
        )}
        <FlatList
          horizontal={true}
          contentContainerStyle={styles.scrollViewContainer}
          snapToInterval={320}
          snapToAlignment={"start"}
          data={plans}
          renderItem={renderTrainingPlanCard}
          keyExtractor={(item: number, index: number) => index.toString()}
        />
        <ThemedText style={styles.sectionTitle}>Build muscle</ThemedText>
        <FlatList
          horizontal={true}
          contentContainerStyle={styles.scrollViewContainer}
          snapToInterval={320}
          snapToAlignment={"start"}
          data={[1, 2, 3, 4, 5, 6]}
          renderItem={() => <TrainingPlanCard onPress={() => {}} />}
          keyExtractor={(item: number, index: number) => index.toString()}
        />
        <ThemedText style={styles.sectionTitle}>Gain strength</ThemedText>
        <FlatList
          horizontal={true}
          contentContainerStyle={styles.scrollViewContainer}
          snapToInterval={320}
          snapToAlignment={"start"}
          data={[1, 2, 3, 4, 5, 6]}
          renderItem={() => <TrainingPlanCard onPress={() => {}} />}
          keyExtractor={(item: number, index: number) => index.toString()}
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
  sectionTitle: {
    marginTop: 10,
    marginLeft: 20,
  },
  scrollViewContainer: {
    justifyContent: "space-between",
    padding: 10,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },
  noPlansText: {
    textAlign: "center",
    marginTop: 50,
    marginBottom: 20,
  },
});
