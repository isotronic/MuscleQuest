import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

interface FriendProfile {
  displayName: string;
  email: string;
  photoURL: string;
}

interface SocialStore {
  pendingRequests: PendingRequest[];
  sentRequests: SentRequest[];
  friends: FriendInfo[];
  privacySettings: FirestorePrivateSettings | null;
  publishedPlanIds: string[] | null;
  publishedWorkoutIds: string[] | null;
  setPendingRequests: (requests: PendingRequest[]) => void;
  setSentRequests: (requests: SentRequest[]) => void;
  setFriends: (friends: FriendInfo[]) => void;
  updateFriendProfile: (uid: string, profile: FriendProfile) => void;
  setPrivacySettings: (settings: FirestorePrivateSettings | null) => void;
  setPublishedPlanIds: (ids: string[] | null) => void;
  setPublishedWorkoutIds: (ids: string[] | null) => void;
}

export const useSocialStore = create<SocialStore>()(
  persist(
    (set) => ({
      pendingRequests: [],
      sentRequests: [],
      friends: [],
      privacySettings: null,
      publishedPlanIds: null,
      publishedWorkoutIds: null,
      setPendingRequests: (pendingRequests) => set({ pendingRequests }),
      setSentRequests: (sentRequests) => set({ sentRequests }),
      setFriends: (friends) => set({ friends }),
      updateFriendProfile: (uid, profile) =>
        set((state) => ({
          friends: state.friends.map((f) =>
            f.uid === uid ? { ...f, ...profile } : f,
          ),
        })),
      setPrivacySettings: (privacySettings) => set({ privacySettings }),
      setPublishedPlanIds: (publishedPlanIds) => set({ publishedPlanIds }),
      setPublishedWorkoutIds: (publishedWorkoutIds) =>
        set({ publishedWorkoutIds }),
    }),
    {
      name: "social-store",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        friends: state.friends,
        privacySettings: state.privacySettings,
        publishedPlanIds: state.publishedPlanIds,
        publishedWorkoutIds: state.publishedWorkoutIds,
      }),
    },
  ),
);
