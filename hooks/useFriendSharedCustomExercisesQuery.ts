import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import firestore from "@react-native-firebase/firestore";
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
      const snap = await firestore()
        .collection("users")
        .doc(friendUid)
        .collection("sharedCustomExercises")
        .get();
      return snap.docs.map((d) => d.data() as SharedCustomExercise);
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
