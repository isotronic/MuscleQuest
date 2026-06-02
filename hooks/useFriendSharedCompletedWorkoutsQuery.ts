import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import firestore from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedCompletedWorkout } from "@/types/firestore";

export const useFriendSharedCompletedWorkoutsQuery = (
  friendUid: string | null,
) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedCompletedWorkouts", friendUid],
    queryFn: async (): Promise<SharedCompletedWorkout[]> => {
      if (!user || !friendUid) return [];
      const snap = await firestore()
        .collection("users")
        .doc(friendUid)
        .collection("sharedWorkouts")
        .get();
      return snap.docs.map((d) => d.data() as SharedCompletedWorkout);
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
