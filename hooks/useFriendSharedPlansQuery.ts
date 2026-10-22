import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  type QueryDocumentSnapshot,
} from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedPlan } from "@/types/firestore";
import { withTimeout } from "@/utils/withTimeout";
import { reportFirestoreReadError } from "@/utils/reportFirestoreReadError";
import { demoMode } from "@/dev/demo/gate";

export const useFriendSharedPlansQuery = (friendUid: string | null) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedPlans", friendUid],
    queryFn: async (): Promise<SharedPlan[]> => {
      if (demoMode?.isDemoUid(friendUid)) {
        return demoMode.demoFriendData(friendUid).plans;
      }
      if (!user || !friendUid) return [];
      const db = getFirestore();
      try {
        const snap = await withTimeout(
          getDocs(collection(db, "users", friendUid, "sharedPlans")),
          15000,
          "friendSharedPlans",
        );
        return snap.docs.map(
          (d: QueryDocumentSnapshot) => d.data() as SharedPlan,
        );
      } catch (error) {
        reportFirestoreReadError("friendSharedPlans", error);
        throw error;
      }
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
