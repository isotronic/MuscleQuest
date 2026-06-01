import { create } from "zustand";
import { FriendInfo } from "../types/firestore";

export interface PendingRequest {
  id: string;
  fromUid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: Date;
}

export interface SentRequest {
  id: string;
  toUid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: Date;
}

interface SocialStore {
  pendingRequests: PendingRequest[];
  sentRequests: SentRequest[];
  friends: FriendInfo[];
  setPendingRequests: (requests: PendingRequest[]) => void;
  setSentRequests: (requests: SentRequest[]) => void;
  setFriends: (friends: FriendInfo[]) => void;
}

export const useSocialStore = create<SocialStore>((set) => ({
  pendingRequests: [],
  sentRequests: [],
  friends: [],
  setPendingRequests: (pendingRequests) => set({ pendingRequests }),
  setSentRequests: (sentRequests) => set({ sentRequests }),
  setFriends: (friends) => set({ friends }),
}));
