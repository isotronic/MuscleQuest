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
  const [isError, setIsError] = useState(false);

  const { workouts, clearWorkouts, planImageUrl, setPlanImageUrl } =
    useWorkoutStore();

  useEffect(() => {
    if (existingPlan) {
      setPlanName(existingPlan.name);
      setPlanImageUrl(existingPlan.image_url);
    }
  }, [existingPlan, setPlanImageUrl]);

  const handleSavePlan = async (planId: number | null) => {
    if (!planName.trim()) {
      Alert.alert("Please enter a plan name");
      return;
    }

    if (!workouts.length) {
      Alert.alert("Please add at least one workout");
      return;
    }

    try {
      if (planId) {
        if (workouts) {
          await updateWorkoutPlan(planId, planName, planImageUrl, workouts);
          queryClient.invalidateQueries({ queryKey: ["plan", planId] });
        } else {
          throw new Error("Workouts are undefined");
        }
      } else {
        await insertWorkoutPlan(planName, planImageUrl, workouts);
      }
      setPlanSaved(true);
    } catch (error) {
      console.error("Error inserting/updating plan data:", error);
      setIsError(true);
    } finally {
      if (!isError && planSaved) {
        clearWorkouts();
        queryClient.invalidateQueries({ queryKey: ["plans"] });
      }
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
