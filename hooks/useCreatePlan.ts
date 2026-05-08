import { useWorkoutStore } from "@/store/workoutStore";
import {
  insertWorkoutPlan,
  openDatabase,
  savePlanSchedule,
  updateSettings,
  updateWorkoutPlan,
} from "@/utils/database";
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

  const {
    workouts,
    clearWorkouts,
    planImageUrl,
    setPlanImageUrl,
    planSchedule,
    clearPlanSchedule,
  } = useWorkoutStore();

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
      let savedPlanId: number;

      if (appPlanId || !planId) {
        newPlanId = await insertWorkoutPlan(planName, planImageUrl, workouts);
        savedPlanId = newPlanId!;
      } else {
        await updateWorkoutPlan(planId, planName, planImageUrl, workouts);
        savedPlanId = planId;
        queryClient.invalidateQueries({ queryKey: ["plan", planId] });
      }

      // Save schedule: resolve workout array indices to IDs
      if (Object.keys(planSchedule).length > 0) {
        try {
          const db = await openDatabase("userData.db");
          const rows = await db.getAllAsync<{ id: number }>(
            `SELECT id FROM user_workouts WHERE plan_id = ? AND is_deleted = FALSE ORDER BY workout_order ASC`,
            [savedPlanId],
          );
          const workoutIds = rows.map((r) => r.id);
          const entries = Object.entries(planSchedule)
            .map(([day, idx]) => ({
              day_of_week: Number(day),
              workout_id: workoutIds[idx],
            }))
            .filter((e) => e.workout_id != null);
          await savePlanSchedule(savedPlanId, entries);
          queryClient.invalidateQueries({
            queryKey: ["planSchedule", savedPlanId],
          });
          // Sync weeklyGoal if this is the currently active plan
          const activePlan = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM user_plans WHERE is_active = TRUE LIMIT 1`,
          );
          if (activePlan?.id === savedPlanId) {
            await updateSettings("weeklyGoal", String(entries.length));
            queryClient.invalidateQueries({ queryKey: ["settings"] });
          }
        } catch (scheduleError: any) {
          console.error("Error saving plan schedule:", scheduleError);
          Bugsnag.notify(scheduleError);
          // Non-critical: don't fail the whole save
        }
      } else {
        // Clear any existing schedule if editor was emptied
        try {
          await savePlanSchedule(savedPlanId, []);
          queryClient.invalidateQueries({
            queryKey: ["planSchedule", savedPlanId],
          });
        } catch (_) {
          // Non-critical
        }
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
        clearPlanSchedule();
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
