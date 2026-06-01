import { useQuery } from "@tanstack/react-query";
import firestore from "@react-native-firebase/firestore";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";

export const useWorkoutPublishQuery = (workoutId: number | null) => {
  const user = useContext(AuthContext);

  return useQuery({
    queryKey: ["workoutPublished", workoutId],
    queryFn: async () => {
      if (!user || !workoutId) return false;
      const doc = await firestore()
        .collection("users")
        .doc(user.uid)
        .collection("sharedStandaloneWorkouts")
        .doc(String(workoutId))
        .get();
      return doc.exists();
    },
    enabled: !!user && !!workoutId,
    staleTime: Infinity,
  });
};
