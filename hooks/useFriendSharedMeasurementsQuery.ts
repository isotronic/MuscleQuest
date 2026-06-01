import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import firestore from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedMeasurement } from "@/types/firestore";

export const useFriendSharedMeasurementsQuery = (friendUid: string | null) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedMeasurements", friendUid],
    queryFn: async (): Promise<SharedMeasurement[]> => {
      if (!user || !friendUid) return [];
      const snap = await firestore()
        .collection("users")
        .doc(friendUid)
        .collection("sharedMeasurements")
        .get();
      return snap.docs.map((d) => d.data() as SharedMeasurement);
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
