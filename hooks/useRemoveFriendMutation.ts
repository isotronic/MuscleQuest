import { useMutation } from "@tanstack/react-query";
import { useContext } from "react";
import { AuthContext } from "../context/AuthProvider";
import { removeFriend } from "../utils/friends";

export const useRemoveFriendMutation = () => {
  const user = useContext(AuthContext);
  return useMutation({
    mutationFn: (friendUid: string) => {
      if (!user) throw new Error("Not authenticated");
      return removeFriend(user.uid, friendUid);
    },
  });
};
