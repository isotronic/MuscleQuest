import { useQuery } from "@tanstack/react-query";
import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";

export const useWorkoutPublishQuery = (workoutId: number | null) => {
  const user = useContext(AuthContext);

  return useQuery({
    queryKey: ["workoutPublished", user?.uid, workoutId],
    queryFn: async () => {
      if (!user || !workoutId) return false;
      const db = getFirestore();
      const docSnap = await getDoc(
        doc(
          db,
          "users",
          user.uid,
          "sharedStandaloneWorkouts",
          String(workoutId),
        ),
      );
      return docSnap.exists();
    },
    enabled: !!user && !!workoutId,
    staleTime: Infinity,
  });
};
