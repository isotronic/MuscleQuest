import { create } from "zustand";

/**
 * Pull-to-refresh on the social screens bumps `generation`, which makes
 * useSocialListeners tear down and re-create its Firestore listeners (the same
 * recovery it does on every app foreground). Not persisted.
 */
interface SocialRefreshStore {
  generation: number;
  requestRefresh: () => void;
}

export const useSocialRefreshStore = create<SocialRefreshStore>((set) => ({
  generation: 0,
  requestRefresh: () => set((s) => ({ generation: s.generation + 1 })),
}));
