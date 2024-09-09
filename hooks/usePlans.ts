import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { fetchAllRecords } from "@/utils/database";
import { Workout } from "@/store/workoutStore";

export interface Plan {
  id: number;
  name: string;
  image_url: string;
  is_active: boolean;
  plan_data: Workout[];
}

export const usePlans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);

  const fetchPlans = useCallback(async () => {
    try {
      const fetchedPlans = (await fetchAllRecords(
        "userData.db",
        "user_plans",
      )) as Plan[];
      setPlans(fetchedPlans);
    } catch (error) {
      console.error("Error fetching plans", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPlans();
    }, [fetchPlans]),
  );

  return plans;
};
