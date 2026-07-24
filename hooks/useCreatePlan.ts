import { useWorkoutStore } from "@/store/workoutStore";
import {
  insertWorkoutPlan,
  openDatabase,
  savePlanSchedule,
  updateSettings,
  updateWorkoutPlan,
} from "@/utils/database";
import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect, useState, useContext } from "react";
import { Alert } from "react-native";
import { Plan } from "./useAllPlansQuery";
import { useQueryClient } from "@tanstack/react-query";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { AuthContext } from "@/context/AuthProvider";
import { publishPlan } from "@/utils/sharing";
import { useSocialStore } from "@/store/socialStore";

export const useCreatePlan = (existingPlan?: Plan) => {
  const queryClient = useQueryClient();
  const user = useContext(AuthContext);
  const { privacySettings, publishedPlanIds } = useSocialStore();
  const [planSaved, setPlanSaved] = useState(false);
  const [planName, setPlanName] = useState("");
  const [isError, setIsError] = useState(false);

  const { workouts, planImageUrl, setPlanImageUrl, planSchedule, clearDraft } =
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

    let localError = false;
    let localPlanSaved = false;

    try {
      let newPlanId: number | null = null;
      let savedPlanId: number;

      if (appPlanId || !planId) {
        newPlanId = await insertWorkoutPlan(planName, planImageUrl, workouts);
        if (newPlanId == null)
          throw new Error("insertWorkoutPlan returned null");
        savedPlanId = newPlanId;

        if (user && privacySettings?.sharePlans) {
          publishPlan(user.uid, newPlanId)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ["publishedPlanIds"] });
              queryClient.invalidateQueries({
                queryKey: ["planPublished", user.uid, newPlanId],
              });
            })
            .catch((err) => notifyBugsnag(err));
        }
      } else {
        await updateWorkoutPlan(planId, planName, planImageUrl, workouts);
        savedPlanId = planId;

        // Auto re-publish if already shared. Reads the locally-synced
        // publishedPlanIds cache instead of a Firestore getDoc so an editing
        // save never blocks on a network round-trip.
        if (user && publishedPlanIds?.includes(String(planId))) {
          publishPlan(user.uid, planId).catch((err) => notifyBugsnag(err));
        }

        queryClient.invalidateQueries({ queryKey: ["plan", planId] });
      }

      // Save schedule: resolve workout array indices to IDs
      if (Object.keys(planSchedule).length > 0) {
        let scheduleDb: SQLiteDatabase | undefined;
        try {
          scheduleDb = await openDatabase("userData.db");
          const rows = await scheduleDb.getAllAsync<{ id: number }>(
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
          const activePlan = await scheduleDb.getFirstAsync<{ id: number }>(
            `SELECT id FROM user_plans WHERE is_active = TRUE LIMIT 1`,
          );
          if (activePlan?.id === savedPlanId) {
            await updateSettings("weeklyGoal", String(entries.length));
            queryClient.invalidateQueries({ queryKey: ["settings"] });
          }
        } catch (scheduleError: any) {
          console.error("Error saving plan schedule:", scheduleError);
          notifyBugsnag(scheduleError);
          // Non-critical: don't fail the whole save
        } finally {
          if (scheduleDb) {
            try {
              await scheduleDb.closeAsync();
            } catch (closeError: any) {
              notifyBugsnag(closeError);
            }
          }
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
      localPlanSaved = true;
      return newPlanId ?? undefined;
    } catch (error: any) {
      console.error("Error inserting/updating plan data:", error);
      notifyBugsnag(error);
      setIsError(true);
      localError = true;
    } finally {
      if (localPlanSaved && !localError) {
        clearDraft();
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
