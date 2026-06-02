import { useMutation } from "@tanstack/react-query";
import { useContext } from "react";
import { AuthContext } from "../context/AuthProvider";
import { sendFriendRequest } from "../utils/friends";

export const useSendFriendRequestMutation = () => {
  const user = useContext(AuthContext);
  return useMutation({
    mutationFn: (toUid: string) => {
      if (!user) throw new Error("Not authenticated");
      return sendFriendRequest(user.uid, toUid);
    },
  });
};
