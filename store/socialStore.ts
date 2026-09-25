import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FriendInfo, FirestorePrivateSettings } from "../types/firestore";

export interface PendingRequest {
  id: string;
  fromUid: string;
  displayName: string;
  photoURL: string;
  createdAt: Date;
}

export interface SentRequest {
  id: string;
  toUid: string;
  displayName: string;
  photoURL: string;
  createdAt: Date;
}

interface FriendProfile {
  displayName: string;
  photoURL: string;
}

// A revocation the user asked for that did not fully succeed. Scoped to the
// uid that asked for it: this outlives sign-out in AsyncStorage, and retrying
// it against whoever signs in next would delete a different person's data.
export interface PendingRevocation {
  uid: string;
  subcollections: string[];
}

interface SocialStore {
  pendingRequests: PendingRequest[];
  sentRequests: SentRequest[];
  friends: FriendInfo[];
  privacySettings: FirestorePrivateSettings | null;
  publishedPlanIds: string[] | null;
  publishedWorkoutIds: string[] | null;
  // Persisted so the retry in useSocialSyncOnStartup survives an app restart:
  // the user asked for this data to stop being visible, so we keep trying
  // until it is gone.
  pendingRevocation: PendingRevocation | null;
  setPendingRequests: (requests: PendingRequest[]) => void;
  setSentRequests: (requests: SentRequest[]) => void;
  setFriends: (friends: FriendInfo[]) => void;
  updateFriendProfile: (uid: string, profile: FriendProfile) => void;
  setPrivacySettings: (settings: FirestorePrivateSettings | null) => void;
  setPublishedPlanIds: (ids: string[] | null) => void;
  setPublishedWorkoutIds: (ids: string[] | null) => void;
  setPendingRevocation: (revocation: PendingRevocation | null) => void;
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
      pendingRevocation: null,
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
      setPendingRevocation: (pendingRevocation) => set({ pendingRevocation }),
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
        pendingRevocation: state.pendingRevocation,
      }),
    },
  ),
);
