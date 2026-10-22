import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  type QueryDocumentSnapshot,
} from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedMeasurement } from "@/types/firestore";
import { withTimeout } from "@/utils/withTimeout";
import { reportFirestoreReadError } from "@/utils/reportFirestoreReadError";
import { demoMode } from "@/dev/demo/gate";

export const useFriendSharedMeasurementsQuery = (friendUid: string | null) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedMeasurements", friendUid],
    queryFn: async (): Promise<SharedMeasurement[]> => {
      if (demoMode?.isDemoUid(friendUid)) {
        return demoMode.demoFriendData(friendUid).measurements;
      }
      if (!user || !friendUid) return [];
      const db = getFirestore();
      try {
        const snap = await withTimeout(
          getDocs(
            query(
              collection(db, "users", friendUid, "sharedMeasurements"),
              orderBy("recordedAt", "desc"),
              limit(5),
            ),
          ),
          15000,
          "friendSharedMeasurements",
        );
        return snap.docs.map(
          (d: QueryDocumentSnapshot) => d.data() as SharedMeasurement,
        );
      } catch (error) {
        reportFirestoreReadError("friendSharedMeasurements", error);
        throw error;
      }
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
