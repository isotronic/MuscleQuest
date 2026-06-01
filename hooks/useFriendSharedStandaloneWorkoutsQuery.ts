import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import firestore from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedStandaloneWorkout } from "@/types/firestore";

export const useFriendSharedStandaloneWorkoutsQuery = (
  friendUid: string | null,
) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedStandaloneWorkouts", friendUid],
    queryFn: async (): Promise<SharedStandaloneWorkout[]> => {
      if (!user || !friendUid) return [];
      const snap = await firestore()
        .collection("users")
        .doc(friendUid)
        .collection("sharedStandaloneWorkouts")
        .get();
      return snap.docs.map((d) => d.data() as SharedStandaloneWorkout);
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
