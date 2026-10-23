import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  type QueryDocumentSnapshot,
} from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedCustomExercise } from "@/types/firestore";
import { withTimeout } from "@/utils/withTimeout";
import { reportFirestoreReadError } from "@/utils/reportFirestoreReadError";
import { demoMode } from "@/dev/demo/gate";

export const useFriendSharedCustomExercisesQuery = (
  friendUid: string | null,
) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedCustomExercises", friendUid],
    queryFn: async (): Promise<SharedCustomExercise[]> => {
      if (demoMode?.isDemoUid(friendUid)) {
        return demoMode.demoFriendData(friendUid).customExercises;
      }
      if (!user || !friendUid) return [];
      const db = getFirestore();
      try {
        const snap = await withTimeout(
          getDocs(collection(db, "users", friendUid, "sharedCustomExercises")),
          15000,
          "friendSharedCustomExercises",
        );
        return snap.docs.map(
          (d: QueryDocumentSnapshot) => d.data() as SharedCustomExercise,
        );
      } catch (error) {
        reportFirestoreReadError("friendSharedCustomExercises", error);
        throw error;
      }
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
