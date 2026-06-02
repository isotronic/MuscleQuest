import { useQuery } from "@tanstack/react-query";
import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";

export const usePlanPublishQuery = (planId: number | null) => {
  const user = useContext(AuthContext);

  return useQuery({
    queryKey: ["planPublished", user?.uid, planId],
    queryFn: async () => {
      if (!user || !planId) return false;
      const db = getFirestore();
      const docSnap = await getDoc(
        doc(db, "users", user.uid, "sharedPlans", String(planId)),
      );
      return docSnap.exists();
    },
    enabled: !!user && !!planId,
    staleTime: Infinity,
  });
};
