import Bugsnag from "@bugsnag/expo";
import {
  AccountDeletionError,
  DELETION_STEPS,
  deleteAccount,
} from "../accountDeletion";
import { useSocialStore } from "../../store/socialStore";

const calls: string[] = [];
const mockUser = { uid: "me", email: "me@example.com" };
const mockAuth: { currentUser: typeof mockUser | null } = {
  currentUser: mockUser,
};

const mockSignIn = jest.fn();
const mockReauth = jest.fn();
const mockDeleteUser = jest.fn();
const mockRevokeAccess = jest.fn();
const mockGoogleSignOut = jest.fn();
const mockGetDocs = jest.fn();
const mockDeleteDoc = jest.fn();
const mockListAll = jest.fn();
const mockDeleteObject = jest.fn();
const mockRemoveFriend = jest.fn();
const mockDeleteShared = jest.fn();
const mockDeleteEmailIndex = jest.fn();

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: () => mockAuth,
  GoogleAuthProvider: { credential: (token: string) => `cred:${token}` },
  reauthenticateWithCredential: (...args: unknown[]) => mockReauth(...args),
  deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
}));

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(),
  collection: (_db: unknown, ...segments: string[]) => segments.join("/"),
  doc: (_db: unknown, ...segments: string[]) => segments.join("/"),
  query: (coll: string, clause: string) => `${coll}?${clause}`,
  where: (field: string, _op: string, value: string) => `${field}=${value}`,
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
}));

jest.mock("@react-native-firebase/storage", () => ({
  getStorage: jest.fn(),
  ref: (_storage: unknown, path: string) => path,
  listAll: (...args: unknown[]) => mockListAll(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: (...args: unknown[]) => mockSignIn(...args),
    revokeAccess: (...args: unknown[]) => mockRevokeAccess(...args),
    signOut: (...args: unknown[]) => mockGoogleSignOut(...args),
  },
  statusCodes: { SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED" },
}));

jest.mock("../friends", () => ({
  removeFriend: (...args: unknown[]) => mockRemoveFriend(...args),
}));

jest.mock("../sharing", () => ({
  deleteAllSharedData: (...args: unknown[]) => mockDeleteShared(...args),
}));

jest.mock("../emailIndex", () => ({
  deleteEmailIndex: (...args: unknown[]) => mockDeleteEmailIndex(...args),
}));

const snapshot = (ids: string[]) => ({
  docs: ids.map((id) => ({ id, ref: `ref:${id}` })),
});

beforeEach(() => {
  jest.clearAllMocks();
  calls.length = 0;
  mockAuth.currentUser = mockUser;

  const record =
    (name: string) =>
    async (...args: unknown[]) => {
      calls.push(`${name}(${args.map(String).join(", ")})`);
    };

  mockSignIn.mockImplementation(async () => {
    calls.push("signIn");
    return { idToken: "token" };
  });
  mockReauth.mockImplementation(record("reauth"));
  mockDeleteUser.mockImplementation(record("deleteUser"));
  mockRevokeAccess.mockImplementation(record("revokeAccess"));
  mockGoogleSignOut.mockImplementation(record("googleSignOut"));
  mockDeleteDoc.mockImplementation(record("deleteDoc"));
  mockDeleteObject.mockImplementation(record("deleteObject"));
  mockRemoveFriend.mockImplementation(record("removeFriend"));
  mockDeleteShared.mockImplementation(record("deleteShared"));
  mockDeleteEmailIndex.mockImplementation(record("deleteEmailIndex"));
  mockGetDocs.mockImplementation(async (target: string) => {
    if (target === "users/me/friends") return snapshot(["f1", "f2"]);
    if (target === "friendRequests?from=me") return snapshot(["me_x"]);
    if (target === "friendRequests?to=me") return snapshot(["y_me"]);
    return snapshot([]);
  });
  mockListAll.mockImplementation(async () => ({
    items: ["backups/me/slotA.db", "backups/me/manifest.json"],
  }));
});

describe("deleteAccount", () => {
  it("deletes everything in order, with the auth user last", async () => {
    await deleteAccount("me");

    expect(calls).toEqual([
      "signIn",
      "reauth([object Object], cred:token)",
      "removeFriend(me, f1)",
      "removeFriend(me, f2)",
      "deleteDoc(ref:me_x)",
      "deleteDoc(ref:y_me)",
      "deleteShared(me)",
      "deleteEmailIndex(me@example.com)",
      "deleteDoc(users/me/private/contact)",
      "deleteDoc(users/me/private/settings)",
      "deleteDoc(users/me)",
      "deleteObject(backups/me/slotA.db)",
      "deleteObject(backups/me/manifest.json)",
      "deleteUser([object Object])",
      "revokeAccess()",
      "googleSignOut()",
    ]);
  });

  it("reports each step as it starts", async () => {
    const started: string[] = [];
    await deleteAccount("me", (step) => started.push(step));
    expect(started).toEqual([...DELETION_STEPS]);
  });

  it("stops before deleting anything when re-auth fails", async () => {
    mockReauth.mockRejectedValue(
      Object.assign(new Error("mismatch"), { code: "auth/user-mismatch" }),
    );

    const error = await deleteAccount("me").catch((e) => e);

    expect(error).toBeInstanceOf(AccountDeletionError);
    expect(error.step).toBe("reauth");
    expect(error.cancelled).toBe(false);
    expect(mockRemoveFriend).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(Bugsnag.notify).toHaveBeenCalledTimes(1);
  });

  it("stops before re-auth when a different user is signed in", async () => {
    mockAuth.currentUser = { uid: "someone-else", email: "other@example.com" };

    const error = await deleteAccount("me").catch((e) => e);

    expect(error.step).toBe("reauth");
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("stops when Google returns no ID token", async () => {
    mockSignIn.mockResolvedValue({ idToken: null });

    const error = await deleteAccount("me").catch((e) => e);

    expect(error.step).toBe("reauth");
    expect(mockReauth).not.toHaveBeenCalled();
    expect(mockRemoveFriend).not.toHaveBeenCalled();
  });

  it("attempts every friend removal before failing the friends step", async () => {
    mockRemoveFriend.mockRejectedValueOnce(new Error("offline"));

    const error = await deleteAccount("me").catch((e) => e);

    expect(error.step).toBe("friends");
    expect(mockRemoveFriend).toHaveBeenCalledWith("me", "f1");
    expect(mockRemoveFriend).toHaveBeenCalledWith("me", "f2");
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it("marks a dismissed Google prompt as cancelled and does not report it", async () => {
    mockSignIn.mockRejectedValue(
      Object.assign(new Error("cancelled"), { code: "SIGN_IN_CANCELLED" }),
    );

    const error = await deleteAccount("me").catch((e) => e);

    expect(error.step).toBe("reauth");
    expect(error.cancelled).toBe(true);
    expect(Bugsnag.notify).not.toHaveBeenCalled();
  });

  it("leaves the auth user intact when shared content deletion fails", async () => {
    mockDeleteShared.mockRejectedValue(new Error("permission-denied"));

    const error = await deleteAccount("me").catch((e) => e);

    expect(error).toBeInstanceOf(AccountDeletionError);
    expect(error.step).toBe("shared");
    expect(mockDeleteDoc).not.toHaveBeenCalledWith("users/me");
    expect(mockListAll).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockRevokeAccess).not.toHaveBeenCalled();
  });

  it("finishes on retry after a partial failure", async () => {
    mockDeleteShared.mockRejectedValueOnce(new Error("offline"));
    await expect(deleteAccount("me")).rejects.toThrow(AccountDeletionError);

    // Friends and requests were already removed by the first attempt.
    mockGetDocs.mockResolvedValue(snapshot([]));
    await deleteAccount("me");

    expect(mockDeleteShared).toHaveBeenCalledTimes(2);
    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
  });

  it("treats backups that are already gone as deleted", async () => {
    mockDeleteObject.mockRejectedValue(
      Object.assign(new Error("gone"), { code: "storage/object-not-found" }),
    );

    await deleteAccount("me");

    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
  });

  it("fails the backups step on other storage errors", async () => {
    mockDeleteObject.mockRejectedValue(
      Object.assign(new Error("denied"), { code: "storage/unauthorized" }),
    );

    const error = await deleteAccount("me").catch((e) => e);

    expect(error.step).toBe("backups");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("clears local social state after the account is gone", async () => {
    useSocialStore.setState({
      friends: [{ uid: "f1" } as never],
      publishedPlanIds: ["1"],
    });

    await deleteAccount("me");

    const state = useSocialStore.getState();
    expect(state.friends).toEqual([]);
    expect(state.publishedPlanIds).toBeNull();
  });

  it("still succeeds when Google revoke fails after deletion", async () => {
    mockRevokeAccess.mockRejectedValue(new Error("network"));

    await expect(deleteAccount("me")).resolves.toBeUndefined();
    expect(Bugsnag.notify).toHaveBeenCalledTimes(1);
    expect(mockGoogleSignOut).toHaveBeenCalledTimes(1);
  });
});
