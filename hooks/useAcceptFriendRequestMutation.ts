import { useMutation } from "@tanstack/react-query";
import { useContext } from "react";
import { AuthContext } from "../context/AuthProvider";
import { acceptFriendRequest } from "../utils/friends";

export const useAcceptFriendRequestMutation = () => {
  const user = useContext(AuthContext);
  return useMutation({
    mutationFn: (fromUid: string) => {
      if (!user) throw new Error("Not authenticated");
      return acceptFriendRequest(fromUid, user.uid);
    },
  });
};
