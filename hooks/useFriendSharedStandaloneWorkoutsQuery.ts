import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  type QueryDocumentSnapshot,
} from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedStandaloneWorkout } from "@/types/firestore";
import { withTimeout } from "@/utils/withTimeout";
import { reportFirestoreReadError } from "@/utils/reportFirestoreReadError";
import { demoMode } from "@/dev/demo/gate";

export const useFriendSharedStandaloneWorkoutsQuery = (
  friendUid: string | null,
) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedStandaloneWorkouts", user?.uid, friendUid],
    queryFn: async (): Promise<SharedStandaloneWorkout[]> => {
      if (demoMode?.isDemoUid(friendUid)) {
        return demoMode.demoFriendData(friendUid).standaloneWorkouts;
      }
      if (!user || !friendUid) return [];
      const db = getFirestore();
      try {
        const snap = await withTimeout(
          getDocs(
            collection(db, "users", friendUid, "sharedStandaloneWorkouts"),
          ),
          15000,
          "friendSharedStandaloneWorkouts",
        );
        return snap.docs.map(
          (d: QueryDocumentSnapshot) => d.data() as SharedStandaloneWorkout,
        );
      } catch (error) {
        reportFirestoreReadError("friendSharedStandaloneWorkouts", error);
        throw error;
      }
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
