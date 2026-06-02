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

export const useFriendSharedMeasurementsQuery = (friendUid: string | null) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedMeasurements", friendUid],
    queryFn: async (): Promise<SharedMeasurement[]> => {
      if (!user || !friendUid) return [];
      const db = getFirestore();
      const snap = await getDocs(
        collection(db, "users", friendUid, "sharedMeasurements"),
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
