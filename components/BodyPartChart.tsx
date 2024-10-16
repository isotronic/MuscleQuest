import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { Exercise } from "@/utils/database";
import { Card } from "react-native-paper";

// Define the props for the component
interface BodyPartChartProps {
  completedWorkouts: CompletedWorkout[] | undefined;
  exercises: Exercise[] | undefined;
}

const BodyPartChart: React.FC<BodyPartChartProps> = ({
  completedWorkouts,
  exercises,
}) => {
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

  // Calculate body part counts
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

          counts[bodyPart] = (counts[bodyPart] || 0) + 1;
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
      percentage: ((count / total) * 100).toFixed(2),
    }));
  }, [bodyPartCounts]);

  const chartData = bodyPartPercentages.map((item) => ({
    text: item.name,
    value: parseFloat(item.percentage),
    color: chartColors[item.name] || "#c4f",
  }));

  // Function to render the colored dot
  const renderDot = (color: string) => (
    <View
      style={{
        height: 8,
        width: 8,
        borderRadius: 5,
        backgroundColor: color,
        marginRight: 4,
      }}
    />
  );

  // Function to render the legend component
  const renderLegendComponent = () => (
    <View style={styles.legendContainer}>
      {chartData.map((item) => (
        <View key={item.text} style={styles.legendItem}>
          {renderDot(item.color)}
          <ThemedText style={styles.legendText}>{`${item.text}`}</ThemedText>
        </View>
      ))}
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
              innerRadius={110}
              radius={150}
              innerCircleColor={Colors.dark.cardBackground}
              centerLabelComponent={() => (
                <View style={styles.pieChartCenterLabelContainer}>
                  <ThemedText style={styles.pieChartCenterLabel}>
                    Body Parts Trained
                  </ThemedText>
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
});
