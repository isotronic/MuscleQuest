import React from "react";
import { FlatList, StyleSheet } from "react-native";
import TrainingPlanCard from "@/components/TrainingPlanCard";
import { ThemedText } from "@/components/ThemedText";
import { Plan } from "@/hooks/useAllPlansQuery";

interface PlanListProps {
  title: string;
  data: Plan[] | undefined | any;
  onPressItem: (item: any) => void;
}

export const PlanList: React.FC<PlanListProps> = ({
  title,
  data,
  onPressItem,
}) => (
  <>
    <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
    {data?.length === 0 && (
      <ThemedText style={styles.noPlansText}>
        No training plans found
      </ThemedText>
    )}
    <FlatList
      horizontal={true}
      contentContainerStyle={styles.scrollViewContainer}
      snapToInterval={320}
      snapToAlignment="start"
      data={data}
      renderItem={({ item }: { item: Plan }) => (
        <TrainingPlanCard
          title={item.name}
          imageUrl={item.image_url}
          onPress={() => onPressItem(item)}
        />
      )}
      keyExtractor={(item: any, index: number) => index.toString()}
    />
  </>
);

const styles = StyleSheet.create({
  sectionTitle: {
    marginTop: 10,
    marginLeft: 20,
  },
  scrollViewContainer: {
    justifyContent: "space-between",
    padding: 10,
  },
  noPlansText: {
    textAlign: "center",
    marginTop: 50,
    marginBottom: 20,
  },
});
