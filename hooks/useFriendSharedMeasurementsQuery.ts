import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedMeasurement } from "@/types/firestore";
import { withTimeout } from "@/utils/withTimeout";

export const useFriendSharedMeasurementsQuery = (friendUid: string | null) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedMeasurements", friendUid],
    queryFn: async (): Promise<SharedMeasurement[]> => {
      if (!user || !friendUid) return [];
      const db = getFirestore();
      const snap = await withTimeout(
        getDocs(collection(db, "users", friendUid, "sharedMeasurements")),
        15000,
        "friendSharedMeasurements",
      );
      return snap.docs.map(
        (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
          d.data() as SharedMeasurement,
      );
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
