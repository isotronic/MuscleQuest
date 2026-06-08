import { useMutation } from "@tanstack/react-query";
import { useContext } from "react";
import { AuthContext } from "../context/AuthProvider";
import { acceptFriendRequest } from "../utils/friends";

interface AcceptParams {
  fromUid: string;
  fromProfile: { displayName: string; email: string; photoURL: string };
}

export const useAcceptFriendRequestMutation = () => {
  const user = useContext(AuthContext);
  return useMutation({
    mutationFn: async ({ fromUid, fromProfile }: AcceptParams) => {
      if (!user) throw new Error("Not authenticated");
      return acceptFriendRequest(fromUid, user.uid, fromProfile, {
        displayName: user.displayName ?? "",
        email: user.email ?? "",
        photoURL: user.photoURL ?? "",
      });
    },
  });
};
