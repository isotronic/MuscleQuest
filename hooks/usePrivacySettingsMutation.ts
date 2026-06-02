import { useMutation } from "@tanstack/react-query";
import { getFirestore, doc, updateDoc } from "@react-native-firebase/firestore";
import Bugsnag from "@bugsnag/expo";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";
import type { FirestorePrivateSettings } from "@/types/firestore";

export const usePrivacySettingsMutation = () => {
  const user = useContext(AuthContext);

  return useMutation({
    mutationFn: async (patch: Partial<FirestorePrivateSettings>) => {
      if (!user)
        throw new Error("usePrivacySettingsMutation: user not authenticated");
      const db = getFirestore();
      await updateDoc(doc(db, "users", user.uid, "private", "settings"), patch);
    },
    onError: (error: Error) => {
      Bugsnag.notify(error);
    },
  });
};
