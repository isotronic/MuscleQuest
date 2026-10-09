import {
  claimLocalData,
  clearLocalDataOwner,
  dismissOwnershipPrompt,
  isLocalDataOwnedBy,
  OWNER_UID_SETTING,
  resolveAccountOwnership,
} from "../accountOwnership";
import { useAccountOwnershipStore } from "@/store/accountOwnershipStore";
import { deleteSetting, fetchSetting, updateSettings } from "@/utils/database";

jest.mock("@/utils/database", () => ({
  fetchSetting: jest.fn(),
  updateSettings: jest.fn().mockResolvedValue(undefined),
  deleteSetting: jest.fn().mockResolvedValue(undefined),
}));

const initialState = useAccountOwnershipStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  useAccountOwnershipStore.setState(initialState, true);
});

const state = () => useAccountOwnershipStore.getState();

describe("resolveAccountOwnership", () => {
  it("records the first account to sign in, silently", async () => {
    (fetchSetting as jest.Mock).mockResolvedValue(null);

    await resolveAccountOwnership("alice");

    expect(updateSettings).toHaveBeenCalledWith(OWNER_UID_SETTING, "alice");
    expect(state()).toMatchObject({
      ownerUid: "alice",
      ownedByCurrentUser: true,
      promptVisible: false,
    });
  });

  it("does nothing more for the same account", async () => {
    (fetchSetting as jest.Mock).mockResolvedValue("alice");

    await resolveAccountOwnership("alice");

    expect(updateSettings).not.toHaveBeenCalled();
    expect(state().ownedByCurrentUser).toBe(true);
  });

  it("pauses and asks when a different account signs in", async () => {
    (fetchSetting as jest.Mock).mockResolvedValue("alice");

    await resolveAccountOwnership("bob");

    expect(updateSettings).not.toHaveBeenCalled();
    expect(state()).toMatchObject({
      ownerUid: "alice",
      ownedByCurrentUser: false,
      promptVisible: true,
    });
  });

  it("keeps the owner when signed out", async () => {
    (fetchSetting as jest.Mock).mockResolvedValue("alice");
    await resolveAccountOwnership("alice");

    await resolveAccountOwnership(null);

    expect(updateSettings).not.toHaveBeenCalled();
    expect(deleteSetting).not.toHaveBeenCalled();
    expect(state().ownedByCurrentUser).toBe(false);
  });

  // An unreadable setting must not lock the user out of backups and sharing
  // that worked before this check existed.
  it("treats an unreadable setting as owned", async () => {
    (fetchSetting as jest.Mock).mockRejectedValue(new Error("locked"));

    await resolveAccountOwnership("alice");

    expect(state().ownedByCurrentUser).toBe(true);
    expect(state().promptVisible).toBe(false);
  });
});

describe("claimLocalData", () => {
  it("makes the signed-in account the owner and resumes", async () => {
    (fetchSetting as jest.Mock).mockResolvedValue("alice");
    await resolveAccountOwnership("bob");

    await claimLocalData("bob");

    expect(updateSettings).toHaveBeenCalledWith(OWNER_UID_SETTING, "bob");
    expect(state()).toMatchObject({
      ownerUid: "bob",
      ownedByCurrentUser: true,
      promptVisible: false,
    });
  });
});

describe("dismissOwnershipPrompt", () => {
  it("hides the prompt but stays paused", async () => {
    (fetchSetting as jest.Mock).mockResolvedValue("alice");
    await resolveAccountOwnership("bob");

    dismissOwnershipPrompt();

    expect(state().promptVisible).toBe(false);
    expect(state().ownedByCurrentUser).toBe(false);
  });
});

describe("clearLocalDataOwner", () => {
  it("forgets the owner so the next account claims the data", async () => {
    (fetchSetting as jest.Mock).mockResolvedValue("alice");
    await resolveAccountOwnership("alice");

    await clearLocalDataOwner();

    expect(deleteSetting).toHaveBeenCalledWith(OWNER_UID_SETTING);
    expect(state().ownerUid).toBeNull();
  });
});

describe("isLocalDataOwnedBy", () => {
  it("answers once ownership is known", async () => {
    (fetchSetting as jest.Mock).mockResolvedValue("alice");
    const answer = isLocalDataOwnedBy("alice");

    await resolveAccountOwnership("alice");

    await expect(answer).resolves.toBe(true);
  });

  it("answers false for an account that does not own the data", async () => {
    (fetchSetting as jest.Mock).mockResolvedValue("alice");
    await resolveAccountOwnership("bob");

    await expect(isLocalDataOwnedBy("bob")).resolves.toBe(false);
  });

  it("answers false for a uid other than the resolved one", async () => {
    (fetchSetting as jest.Mock).mockResolvedValue("alice");
    await resolveAccountOwnership("alice");

    await expect(isLocalDataOwnedBy("mallory")).resolves.toBe(false);
  });

  it("gives up as not owned if ownership never resolves", async () => {
    jest.useFakeTimers();
    try {
      const answer = isLocalDataOwnedBy("alice");
      await jest.advanceTimersByTimeAsync(30_000);
      await expect(answer).resolves.toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
