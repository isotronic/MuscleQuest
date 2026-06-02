import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
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
      const db = getFirestore();
      const snap = await getDocs(
        collection(db, "users", friendUid, "sharedWorkouts"),
      );
      return snap.docs.map(
        (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
          d.data() as SharedCompletedWorkout,
      );
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
