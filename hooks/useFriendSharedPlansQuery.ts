import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedPlan } from "@/types/firestore";

export const useFriendSharedPlansQuery = (friendUid: string | null) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedPlans", friendUid],
    queryFn: async (): Promise<SharedPlan[]> => {
      if (!user || !friendUid) return [];
      const db = getFirestore();
      const snap = await getDocs(
        collection(db, "users", friendUid, "sharedPlans"),
      );
      return snap.docs.map(
        (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
          d.data() as SharedPlan,
      );
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
