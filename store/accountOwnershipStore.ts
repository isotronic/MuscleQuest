import { create } from "zustand";

interface AccountOwnershipStore {
  /** The account this device's training data belongs to, once known. */
  ownerUid: string | null;
  /** The signed-in account, set as soon as auth reports it. */
  currentUid: string | null;
  /** The account ownership was last resolved for. */
  resolvedFor: string | null;
  /** True when the signed-in account owns the local data. */
  ownedByCurrentUser: boolean;
  /** Drives AccountOwnershipPrompt, mounted once in the app layout. */
  promptVisible: boolean;
}

/**
 * Who the local data belongs to. Written by utils/accountOwnership.ts only;
 * not persisted, since the owner itself lives in the settings table.
 */
export const useAccountOwnershipStore = create<AccountOwnershipStore>(() => ({
  ownerUid: null,
  currentUid: null,
  resolvedFor: null,
  ownedByCurrentUser: false,
  promptVisible: false,
}));
