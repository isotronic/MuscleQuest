import { useMutation } from "@tanstack/react-query";
import firestore from "@react-native-firebase/firestore";
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
      await firestore()
        .collection("users")
        .doc(user.uid)
        .collection("private")
        .doc("settings")
        .update(patch);
    },
    onError: (error: Error) => {
      Bugsnag.notify(error);
    },
  });
};
