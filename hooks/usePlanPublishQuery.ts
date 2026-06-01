import { useQuery } from "@tanstack/react-query";
import firestore from "@react-native-firebase/firestore";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";

export const usePlanPublishQuery = (planId: number | null) => {
  const user = useContext(AuthContext);

  return useQuery({
    queryKey: ["planPublished", planId],
    queryFn: async () => {
      if (!user || !planId) return false;
      const doc = await firestore()
        .collection("users")
        .doc(user.uid)
        .collection("sharedPlans")
        .doc(String(planId))
        .get();
      return doc.exists();
    },
    enabled: !!user && !!planId,
    staleTime: Infinity,
  });
};
