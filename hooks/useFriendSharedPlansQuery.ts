import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import firestore from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedPlan } from "@/types/firestore";

export const useFriendSharedPlansQuery = (friendUid: string | null) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedPlans", friendUid],
    queryFn: async (): Promise<SharedPlan[]> => {
      if (!user || !friendUid) return [];
      const snap = await firestore()
        .collection("users")
        .doc(friendUid)
        .collection("sharedPlans")
        .get();
      return snap.docs.map((d) => d.data() as SharedPlan);
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
