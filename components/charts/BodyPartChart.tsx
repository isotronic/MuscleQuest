import React, { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { Exercise } from "@/utils/database";
import { Card } from "react-native-paper";
import { capitalizeWords } from "@/utils/utility";

// Define the props for the component
interface BodyPartChartProps {
  completedWorkouts: CompletedWorkout[] | undefined;
  exercises: Exercise[] | undefined;
}

const BodyPartChart: React.FC<BodyPartChartProps> = ({
  completedWorkouts,
  exercises,
}) => {
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(
    null,
  );

  const chartColors: Record<string, string> = {
    back: "#FF5722", // Deep Orange
    chest: "#3F51B5", // Indigo
    shoulders: "#009688", // Teal
    neck: "#9E9E9E", // Gray
    arms: "#43A047", // Green
    legs: "#5D4037", // Brown
    waist: "#FDD835", // Yellow
    cardio: "#8E24AA", // Purple
  };

  // Map exercise_id to body_part
  const exerciseIdToBodyPartMap = useMemo(() => {
    if (!exercises) {
      return {};
    }
    return exercises.reduce(
      (acc, exercise) => {
        acc[exercise.exercise_id] = exercise.body_part;
        return acc;
      },
      {} as Record<number, string>,
    );
  }, [exercises]);

  // Calculate body part counts based on completed sets
  const bodyPartCounts = useMemo(() => {
    if (!completedWorkouts || !exerciseIdToBodyPartMap) {
      return {};
    }

    const counts: Record<string, number> = {};

    completedWorkouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        let bodyPart = exerciseIdToBodyPartMap[exercise.exercise_id];
        if (bodyPart) {
          // Map upper/lower arms and legs to combined categories
          if (bodyPart === "upper arms" || bodyPart === "lower arms") {
            bodyPart = "arms";
          } else if (bodyPart === "upper legs" || bodyPart === "lower legs") {
            bodyPart = "legs";
          }

          // Count the number of sets for this exercise
          const completedSets = exercise.sets.length;
          counts[bodyPart] = (counts[bodyPart] || 0) + completedSets;
        }
      });
    });

    return counts;
  }, [completedWorkouts, exerciseIdToBodyPartMap]);

  // Calculate body part percentages
  const bodyPartPercentages = useMemo(() => {
    const total = Object.values(bodyPartCounts).reduce(
      (acc, count) => acc + count,
      0,
    );
    if (total === 0) {
      return [];
    }

    return Object.entries(bodyPartCounts).map(([bodyPart, count]) => ({
      name: bodyPart,
      count,
      percentage: ((count / total) * 100).toFixed(1),
    }));
  }, [bodyPartCounts]);

  const chartData = bodyPartPercentages.map((item) => ({
    text: item.name,
    value: parseFloat(item.percentage),
    color: chartColors[item.name] || "#c4f",
    focused: item.name === selectedBodyPart,
  }));

  const handleChartPress = (
    item: { text: string; value: number },
    index: number,
  ) => {
    if (item.text !== selectedBodyPart) {
      setSelectedBodyPart(item.text);
      setSelectedPercentage(item.value);
    } else {
      // If the same section is pressed, set state to null to unfocus
      setSelectedBodyPart(null);
      setSelectedPercentage(null);
    }
  };

  // Function to render the colored dot
  const renderDot = (color: string, isSelected: boolean) => (
    <View
      style={{
        height: isSelected ? 12 : 8,
        width: isSelected ? 12 : 8,
        borderRadius: isSelected ? 10 : 5,
        backgroundColor: color,
        marginRight: 4,
      }}
    />
  );

  // Function to render the legend component
  const renderLegendComponent = () => (
    <View style={styles.legendContainer}>
      {chartData.map((item) => {
        const isSelected = item.text === selectedBodyPart;
        return (
          <View key={item.text} style={styles.legendItem}>
            {renderDot(item.color, isSelected)}
            <ThemedText
              style={[
                styles.legendText,
                isSelected && styles.selectedLegendText,
              ]}
            >
              {`${item.text}`}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );

  return (
    <>
      {chartData.length > 0 ? (
        <Card style={styles.card}>
          <View>
            <PieChart
              donut
              data={chartData}
              radius={150}
              innerRadius={110}
              onPress={handleChartPress}
              sectionAutoFocus
              innerCircleColor={Colors.dark.cardBackground}
              centerLabelComponent={() => (
                <View
                  style={{ justifyContent: "center", alignItems: "center" }}
                >
                  {selectedBodyPart ? (
                    <>
                      <ThemedText style={{ fontSize: 18, fontWeight: "bold" }}>
                        {`${selectedPercentage}%`}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 18 }}>
                        {capitalizeWords(selectedBodyPart)}
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText style={{ fontSize: 18, fontWeight: "bold" }}>
                      Body Parts
                    </ThemedText>
                  )}
                </View>
              )}
            />
            {renderLegendComponent()}
          </View>
        </Card>
      ) : (
        <ThemedText>No data available.</ThemedText>
      )}
    </>
  );
};

export default BodyPartChart;

const styles = StyleSheet.create({
  card: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.dark.cardBackground,
  },
  pieChartLabel: {
    justifyContent: "center",
    alignItems: "center",
  },
  pieChartCenterLabel: {
    fontSize: 18,
    fontWeight: "bold",
  },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
  },
  selectedLegendText: {
    fontSize: 14,
    fontWeight: "bold",
  },
});
