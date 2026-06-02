import { create } from "zustand";
import { FriendInfo, FirestorePrivateSettings } from "../types/firestore";

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
  privacySettings: FirestorePrivateSettings | null;
  setPendingRequests: (requests: PendingRequest[]) => void;
  setSentRequests: (requests: SentRequest[]) => void;
  setFriends: (friends: FriendInfo[]) => void;
  setPrivacySettings: (settings: FirestorePrivateSettings | null) => void;
}

export const useSocialStore = create<SocialStore>((set) => ({
  pendingRequests: [],
  sentRequests: [],
  friends: [],
  privacySettings: null,
  setPendingRequests: (pendingRequests) => set({ pendingRequests }),
  setSentRequests: (sentRequests) => set({ sentRequests }),
  setFriends: (friends) => set({ friends }),
  setPrivacySettings: (privacySettings) => set({ privacySettings }),
}));
