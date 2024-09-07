import { useWorkoutStore } from "@/store/store";
import { insertWorkoutPlan } from "@/utils/database";
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

export const useCreatePlan = () => {
  const [planName, setPlanName] = useState("");
  const [planImageUrl, setPlanImageUrl] = useState(
    "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  );
  const { workouts } = useWorkoutStore();

  const handleSavePlan = () => {
    if (!planName.trim()) {
      Alert.alert("Please enter a plan name");
      return;
    }

    if (!workouts.length) {
      Alert.alert("Please add at least one workout");
      return;
    }

    const planData = JSON.stringify(workouts);

    try {
      insertWorkoutPlan(planName, planImageUrl, planData);
    } catch (error) {
      console.error("Error inserting plan data:", error);
    } finally {
      router.back();
    }
  };

  return {
    planName,
    setPlanName,
    planImageUrl,
    setPlanImageUrl,
    handleSavePlan,
  };
};
