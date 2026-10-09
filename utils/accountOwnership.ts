import { useAccountOwnershipStore } from "@/store/accountOwnershipStore";
import { notifyBugsnag } from "./bugsnagDedup";
import { deleteSetting, fetchSetting, updateSettings } from "./database";

// The training data on a device belongs to the first account that signed in
// there. Another account signing in later must not back it up or publish it
// as its own until the user says so. The owner is kept in the settings table
// so a backup carries it, and it survives sign-out.

export const OWNER_UID_SETTING = "ownerUid";
// The account that chose "Not now", so it is not asked again on every launch.
export const OWNERSHIP_PROMPT_DISMISSED_SETTING = "ownershipPromptDismissedFor";

// Long enough for the settings read at sign-in; a caller still waiting after
// this treats the data as not owned rather than hanging forever.
const RESOLVE_WAIT_MS = 30_000;

const setState = useAccountOwnershipStore.setState;

/** Called by AuthProvider on every auth change. */
export const resolveAccountOwnership = async (
  uid: string | null,
): Promise<void> => {
  setState({ currentUid: uid });
  if (!uid) {
    setState({
      resolvedFor: null,
      ownedByCurrentUser: false,
      promptVisible: false,
    });
    return;
  }

  let ownerUid: string | null;
  try {
    ownerUid = (await fetchSetting(OWNER_UID_SETTING)) || null;
  } catch (error) {
    // Fail open: before this check, every account could back up and share,
    // and locking someone out of their own backups is worse.
    notifyBugsnag(error);
    ownerUid = uid;
  }

  if (!ownerUid) {
    // Every install from before this check, and every fresh one.
    ownerUid = uid;
    try {
      await updateSettings(OWNER_UID_SETTING, uid);
    } catch (error) {
      notifyBugsnag(error);
    }
  }

  // A newer auth change may have landed while the setting was read.
  if (useAccountOwnershipStore.getState().currentUid !== uid) return;

  const owned = ownerUid === uid;
  let promptVisible = !owned;
  if (!owned) {
    try {
      promptVisible =
        (await fetchSetting(OWNERSHIP_PROMPT_DISMISSED_SETTING)) !== uid;
    } catch (error) {
      notifyBugsnag(error);
    }
    if (useAccountOwnershipStore.getState().currentUid !== uid) return;
  }
  setState({
    ownerUid,
    resolvedFor: uid,
    ownedByCurrentUser: owned,
    promptVisible,
  });
};

/** "Use with this account": the signed-in account takes over the data. */
export const claimLocalData = async (uid: string): Promise<void> => {
  await updateSettings(OWNER_UID_SETTING, uid);
  setState({
    ownerUid: uid,
    resolvedFor: uid,
    ownedByCurrentUser: true,
    promptVisible: false,
  });
};

/**
 * "Not now": backups and sharing stay paused, and this account is not asked
 * again. The settings notice still offers the choice.
 */
export const dismissOwnershipPrompt = async (): Promise<void> => {
  setState({ promptVisible: false });
  const uid = useAccountOwnershipStore.getState().currentUid;
  if (!uid) return;
  try {
    await updateSettings(OWNERSHIP_PROMPT_DISMISSED_SETTING, uid);
  } catch (error) {
    notifyBugsnag(error);
  }
};

/** After the owning account is deleted, the next account claims the data. */
export const clearLocalDataOwner = async (): Promise<void> => {
  await deleteSetting(OWNER_UID_SETTING);
  setState({ ownerUid: null, ownedByCurrentUser: false, promptVisible: false });
};

/**
 * Whether local data may be backed up or published as uid. Waits for the
 * sign-in check when it is still running, such as for a save right after
 * launch.
 */
export const isLocalDataOwnedBy = (uid: string): Promise<boolean> =>
  new Promise((resolve) => {
    const answer = (
      state: ReturnType<typeof useAccountOwnershipStore.getState>,
    ) => {
      if (state.resolvedFor === uid) return state.ownedByCurrentUser;
      // Someone else is signed in now.
      if (state.currentUid !== null && state.currentUid !== uid) return false;
      return null;
    };

    const now = answer(useAccountOwnershipStore.getState());
    if (now !== null) {
      resolve(now);
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, RESOLVE_WAIT_MS);
    const unsubscribe = useAccountOwnershipStore.subscribe((state) => {
      const result = answer(state);
      if (result === null) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    });
  });
