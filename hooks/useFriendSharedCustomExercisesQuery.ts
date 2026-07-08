import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedCustomExercise } from "@/types/firestore";
import { withTimeout } from "@/utils/withTimeout";

export const useFriendSharedCustomExercisesQuery = (
  friendUid: string | null,
) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedCustomExercises", friendUid],
    queryFn: async (): Promise<SharedCustomExercise[]> => {
      if (!user || !friendUid) return [];
      const db = getFirestore();
      const snap = await withTimeout(
        getDocs(collection(db, "users", friendUid, "sharedCustomExercises")),
        15000,
        "friendSharedCustomExercises",
      );
      return snap.docs.map(
        (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
          d.data() as SharedCustomExercise,
      );
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
