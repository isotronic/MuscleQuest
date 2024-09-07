import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { fetchAllRecords } from "@/utils/database";
import { Workout } from "@/store/store";

export const usePlans = () => {
  const [plans, setPlans] = useState<Workout[]>([]);

  const fetchPlans = useCallback(async () => {
    try {
      const fetchedPlans = (await fetchAllRecords(
        "userData.db",
        "user_plans",
      )) as Workout[];
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
