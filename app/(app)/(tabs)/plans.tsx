import ScreenHeader from "@/components/ScreenHeader";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import TrainingPlanCard from "@/components/TrainingPlanCard";
import { Colors } from "@/constants/Colors";
import { ScrollView, StyleSheet } from "react-native";
import { FAB } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        stickyHeaderIndices={[0]}
        style={{ marginTop: insets.top }}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <ScreenHeader title="Plans" />
        <ThemedText style={styles.sectionTitle}>Your training plans</ThemedText>
        <ScrollView
          horizontal={true}
          contentContainerStyle={styles.scrollViewContainer}
          snapToInterval={320}
          snapToAlignment={"start"}
        >
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
        </ScrollView>
        <ThemedText style={styles.sectionTitle}>Build muscle</ThemedText>
        <ScrollView
          horizontal={true}
          contentContainerStyle={styles.scrollViewContainer}
          snapToInterval={320}
          snapToAlignment={"start"}
        >
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
        </ScrollView>
        <ThemedText style={styles.sectionTitle}>Gain strength</ThemedText>
        <ScrollView
          horizontal={true}
          contentContainerStyle={styles.scrollViewContainer}
          snapToInterval={320}
          snapToAlignment={"start"}
        >
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
          <TrainingPlanCard />
        </ScrollView>

        <ThemedText style={{ margin: 20, textAlign: "center" }}>
          View all exercises
        </ThemedText>
      </ScrollView>
      <FAB
        icon="plus"
        label="Create plan"
        rippleColor={Colors.dark.tint}
        style={styles.fab}
        onPress={() => {}}
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
