import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";

export const usePublishedPlanIdsQuery = () => {
  const user = useContext(AuthContext);

  return useQuery({
    queryKey: ["publishedPlanIds", user?.uid],
    queryFn: async (): Promise<string[]> => {
      if (!user) return [];
      const db = getFirestore();
      const snap = await getDocs(
        collection(db, "users", user.uid, "sharedPlans"),
      );
      return snap.docs.map(
        (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => d.id,
      );
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};
