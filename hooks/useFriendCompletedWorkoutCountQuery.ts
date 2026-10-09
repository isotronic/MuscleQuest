import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getCountFromServer,
} from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { withTimeout } from "@/utils/withTimeout";
import { reportFirestoreReadError } from "@/utils/reportFirestoreReadError";

/**
 * How many workouts a friend has shared. The list query only fetches the
 * recent ones, so the total comes from a server-side count, which costs one
 * read per thousand documents rather than downloading them.
 */
export const useFriendCompletedWorkoutCountQuery = (
  friendUid: string | null,
) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendCompletedWorkoutCount", friendUid],
    queryFn: async (): Promise<number> => {
      if (!user || !friendUid) return 0;
      const db = getFirestore();
      try {
        const snap = await withTimeout(
          getCountFromServer(
            collection(db, "users", friendUid, "sharedWorkouts"),
          ),
          15000,
          "friendCompletedWorkoutCount",
        );
        return snap.data().count;
      } catch (error) {
        reportFirestoreReadError("friendCompletedWorkoutCount", error);
        throw error;
      }
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
