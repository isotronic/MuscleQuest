import { useMutation } from "@tanstack/react-query";
import { useContext } from "react";
import { AuthContext } from "../context/AuthProvider";
import { declineFriendRequest } from "../utils/friends";

export const useDeclineFriendRequestMutation = () => {
  const user = useContext(AuthContext);
  return useMutation({
    mutationFn: (fromUid: string) => {
      if (!user) throw new Error("Not authenticated");
      return declineFriendRequest(fromUid, user.uid);
    },
  });
};
