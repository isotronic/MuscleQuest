import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFirestore,
  collection,
  getDocs,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedStrengthPR } from "@/types/firestore";
import { withTimeout } from "@/utils/withTimeout";
import { reportFirestoreReadError } from "@/utils/reportFirestoreReadError";

export const useFriendSharedStrengthQuery = (friendUid: string | null) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedStrength", user?.uid, friendUid],
    queryFn: async (): Promise<SharedStrengthPR[]> => {
      if (!user || !friendUid) return [];
      const db = getFirestore();
      try {
        const snap = await withTimeout(
          getDocs(collection(db, "users", friendUid, "sharedStrength")),
          15000,
          "friendSharedStrength",
        );
        return snap.docs.map(
          (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
            d.data() as SharedStrengthPR,
        );
      } catch (error) {
        reportFirestoreReadError("friendSharedStrength", error);
        throw error;
      }
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
