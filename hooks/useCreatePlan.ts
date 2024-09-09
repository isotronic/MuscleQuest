import { useWorkoutStore } from "@/store/workoutStore";
import { insertWorkoutPlan, updateWorkoutPlan } from "@/utils/database";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Plan } from "./useAllPlansQuery";
import { useQueryClient } from "@tanstack/react-query";

export const useCreatePlan = (
  planId: number | null = null,
  existingPlan?: Plan,
) => {
  const queryClient = useQueryClient();
  const [planSaved, setPlanSaved] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planImageUrl, setPlanImageUrl] = useState(
    "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  );
  const { workouts, clearWorkouts } = useWorkoutStore();

  useEffect(() => {
    if (existingPlan) {
      setPlanName(existingPlan.name);
      setPlanImageUrl(existingPlan.image_url);
    }
  }, [existingPlan]);

  const handleSavePlan = async (planId: number | null) => {
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
      if (planId) {
        await updateWorkoutPlan(planId, planName, planImageUrl, planData);
        queryClient.invalidateQueries({ queryKey: ["plan", planId] });
      } else {
        await insertWorkoutPlan(planName, planImageUrl, planData);
      }

      setPlanSaved(true);
    } catch (error) {
      console.error("Error inserting/updating plan data:", error);
    } finally {
      clearWorkouts();
    }
  };

  return {
    planName,
    setPlanName,
    planImageUrl,
    setPlanImageUrl,
    planSaved,
    setPlanSaved,
    handleSavePlan,
  };
};
