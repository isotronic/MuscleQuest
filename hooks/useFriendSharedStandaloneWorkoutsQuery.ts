import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedStandaloneWorkout } from "@/types/firestore";

export const useFriendSharedStandaloneWorkoutsQuery = (
  friendUid: string | null,
) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedStandaloneWorkouts", user?.uid, friendUid],
    queryFn: async (): Promise<SharedStandaloneWorkout[]> => {
      if (!user || !friendUid) return [];
      const db = getFirestore();
      const snap = await getDocs(
        collection(db, "users", friendUid, "sharedStandaloneWorkouts"),
      );
      return snap.docs.map(
        (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
          d.data() as SharedStandaloneWorkout,
      );
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
