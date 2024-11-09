import { useWorkoutStore } from "@/store/workoutStore";
import { insertWorkoutPlan, updateWorkoutPlan } from "@/utils/database";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Plan } from "./useAllPlansQuery";
import { useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

export const useCreatePlan = (existingPlan?: Plan) => {
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

  const handleSavePlan = async (
    planId: number | null,
    appPlanId?: number | null,
  ): Promise<number | void> => {
    if (!planName.trim()) {
      Alert.alert("Please enter a plan name");
      return;
    }

    if (!workouts.length) {
      Alert.alert("Please add at least one workout");
      return;
    }

    try {
      let newPlanId: number | null = null;
      if (appPlanId || !planId) {
        newPlanId = await insertWorkoutPlan(planName, planImageUrl, workouts);
      } else {
        await updateWorkoutPlan(planId, planName, planImageUrl, workouts);
        queryClient.invalidateQueries({ queryKey: ["plan", planId] });
      }
      setPlanSaved(true);
      return newPlanId ?? undefined;
    } catch (error: any) {
      console.error("Error inserting/updating plan data:", error);
      Bugsnag.notify(error);
      setIsError(true);
    } finally {
      if (!isError && planSaved) {
        clearWorkouts();
        queryClient.invalidateQueries({ queryKey: ["plans"] });
        queryClient.invalidateQueries({ queryKey: ["activePlan"] });
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
