import { useQuery } from "@tanstack/react-query";
import firestore from "@react-native-firebase/firestore";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";

export const usePublishedWorkoutIdsQuery = () => {
  const user = useContext(AuthContext);

  return useQuery({
    queryKey: ["publishedWorkoutIds", user?.uid],
    queryFn: async (): Promise<string[]> => {
      if (!user) return [];
      const snap = await firestore()
        .collection("users")
        .doc(user.uid)
        .collection("sharedStandaloneWorkouts")
        .get();
      return snap.docs.map((d) => d.id);
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};
