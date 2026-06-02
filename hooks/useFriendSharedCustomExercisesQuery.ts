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

export const useFriendSharedCustomExercisesQuery = (
  friendUid: string | null,
) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedCustomExercises", friendUid],
    queryFn: async (): Promise<SharedCustomExercise[]> => {
      if (!user || !friendUid) return [];
      const db = getFirestore();
      const snap = await getDocs(
        collection(db, "users", friendUid, "sharedCustomExercises"),
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
