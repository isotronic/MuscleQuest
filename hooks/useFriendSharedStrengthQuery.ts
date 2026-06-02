import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import firestore from "@react-native-firebase/firestore";
import { AuthContext } from "@/context/AuthProvider";
import { SharedStrengthPR } from "@/types/firestore";

export const useFriendSharedStrengthQuery = (friendUid: string | null) => {
  const user = useContext(AuthContext);
  return useQuery({
    queryKey: ["friendSharedStrength", friendUid],
    queryFn: async (): Promise<SharedStrengthPR[]> => {
      if (!user || !friendUid) return [];
      const snap = await firestore()
        .collection("users")
        .doc(friendUid)
        .collection("sharedStrength")
        .get();
      return snap.docs.map((d) => d.data() as SharedStrengthPR);
    },
    enabled: !!user && !!friendUid,
    staleTime: 60_000,
  });
};
