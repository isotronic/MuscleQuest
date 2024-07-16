import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import TrainingPlanCard from "@/components/TrainingPlanCard";
import { Colors } from "@/constants/Colors";
import { router } from "expo-router";
import { FlatList, ScrollView, StyleSheet } from "react-native";
import { FAB } from "react-native-paper";

export default function PlansScreen() {
  const handleCreatePlan = () => {
    router.push("/(app)/(create-plan)/create");
  };
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <ThemedText style={styles.sectionTitle}>Your training plans</ThemedText>
        <FlatList
          horizontal={true}
          contentContainerStyle={styles.scrollViewContainer}
          snapToInterval={320}
          snapToAlignment={"start"}
          data={[1, 2, 3, 4, 5, 6]}
          renderItem={() => <TrainingPlanCard />}
          keyExtractor={(item: number, index: number) => index.toString()}
        />
        <ThemedText style={styles.sectionTitle}>Build muscle</ThemedText>
        <FlatList
          horizontal={true}
          contentContainerStyle={styles.scrollViewContainer}
          snapToInterval={320}
          snapToAlignment={"start"}
          data={[1, 2, 3, 4, 5, 6]}
          renderItem={() => <TrainingPlanCard />}
          keyExtractor={(item: number, index: number) => index.toString()}
        />
        <ThemedText style={styles.sectionTitle}>Gain strength</ThemedText>
        <FlatList
          horizontal={true}
          contentContainerStyle={styles.scrollViewContainer}
          snapToInterval={320}
          snapToAlignment={"start"}
          data={[1, 2, 3, 4, 5, 6]}
          renderItem={() => <TrainingPlanCard />}
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
});
