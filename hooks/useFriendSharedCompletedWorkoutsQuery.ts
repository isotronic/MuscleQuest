import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedCompletedWorkout } from "@/types/firestore";
import { withTimeout } from "@/utils/withTimeout";
import { reportFirestoreReadError } from "@/utils/reportFirestoreReadError";

export const useFriendSharedCompletedWorkoutsQuery = (
  friendUid: string | null,
) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedCompletedWorkouts", friendUid],
    queryFn: async (): Promise<SharedCompletedWorkout[]> => {
      if (!user || !friendUid) return [];
      const db = getFirestore();
      try {
        const snap = await withTimeout(
          getDocs(
            query(
              collection(db, "users", friendUid, "sharedWorkouts"),
              orderBy("dateCompleted", "desc"),
              limit(10),
            ),
          ),
          15000,
          "friendSharedCompletedWorkouts",
        );
        return snap.docs.map(
          (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
            d.data() as SharedCompletedWorkout,
        );
      } catch (error) {
        reportFirestoreReadError("friendSharedCompletedWorkouts", error);
        throw error;
      }
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
