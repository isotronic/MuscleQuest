import { useQuery } from "@tanstack/react-query";
import firestore from "@react-native-firebase/firestore";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";

export const usePublishedPlanIdsQuery = () => {
  const user = useContext(AuthContext);

  return useQuery({
    queryKey: ["publishedPlanIds", user?.uid],
    queryFn: async (): Promise<string[]> => {
      if (!user) return [];
      const snap = await firestore()
        .collection("users")
        .doc(user.uid)
        .collection("sharedPlans")
        .get();
      return snap.docs.map((d) => d.id);
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};
