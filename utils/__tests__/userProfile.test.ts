import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { upsertUserProfile } from "../userProfile";

const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();
const mockUpsertEmailIndex = jest.fn().mockResolvedValue(undefined);
const mockNotifyBugsnag = jest.fn();

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(),
  doc: jest.fn((_db: unknown, ...segments: string[]) => segments.join("/")),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteField: () => "__deleteField__",
  serverTimestamp: () => "__serverTimestamp__",
}));

jest.mock("../emailIndex", () => ({
  upsertEmailIndex: (...args: unknown[]) => mockUpsertEmailIndex(...args),
}));

jest.mock("../bugsnagDedup", () => ({
  notifyBugsnag: (...args: unknown[]) => mockNotifyBugsnag(...args),
}));

const user = {
  uid: "uid-alice",
  displayName: "Alice",
  email: "alice@example.com",
  emailVerified: true,
  photoURL: "https://example.com/alice.jpg",
} as FirebaseAuthTypes.User;

const snapshot = (exists: boolean, data: Record<string, unknown> = {}) => ({
  exists: () => exists,
  data: () => data,
});

const profileWrite = () =>
  mockSetDoc.mock.calls.find(([path]) => path === "users/uid-alice");

beforeEach(() => {
  jest.clearAllMocks();
  mockSetDoc.mockResolvedValue(undefined);
  mockUpsertEmailIndex.mockResolvedValue(undefined);
});

describe("upsertUserProfile", () => {
  it("never writes email to the public profile", async () => {
    mockGetDoc.mockResolvedValue(snapshot(false));

    await upsertUserProfile(user);

    expect(profileWrite()?.[1]).toEqual({
      displayName: "Alice",
      photoURL: "https://example.com/alice.jpg",
      createdAt: "__serverTimestamp__",
    });
  });

  it("writes the address to the private contact doc and the hashed index", async () => {
    mockGetDoc.mockResolvedValue(snapshot(false));

    await upsertUserProfile(user);

    expect(mockUpsertEmailIndex).toHaveBeenCalledWith(
      "uid-alice",
      "alice@example.com",
    );
    expect(mockSetDoc).toHaveBeenCalledWith(
      "users/uid-alice/private/contact",
      { email: "alice@example.com" },
      { merge: true },
    );
  });

  it("strips a legacy email off an existing public profile", async () => {
    mockGetDoc.mockImplementation(async (path: string) =>
      path === "users/uid-alice"
        ? snapshot(true, { email: "alice@example.com" })
        : snapshot(true),
    );

    await upsertUserProfile(user);

    expect(profileWrite()?.[1]).toMatchObject({ email: "__deleteField__" });
  });

  it("leaves the profile alone when it never carried an email", async () => {
    mockGetDoc.mockImplementation(async (path: string) =>
      path === "users/uid-alice"
        ? snapshot(true, { displayName: "Alice" })
        : snapshot(true),
    );

    await upsertUserProfile(user);

    expect(profileWrite()?.[1]).not.toHaveProperty("email");
  });

  it("strips a legacy email even when there is no address to index", async () => {
    // The rules reject any profile carrying `email`, so leaving it in place
    // would block every later merge write on this document.
    mockGetDoc.mockResolvedValue(
      snapshot(true, { email: "alice@example.com" }),
    );

    await upsertUserProfile({ ...user, email: null } as FirebaseAuthTypes.User);

    expect(profileWrite()?.[1]).toMatchObject({ email: "__deleteField__" });
    expect(mockUpsertEmailIndex).not.toHaveBeenCalled();
  });

  // The rules require a verified token email to claim an index entry, so an
  // unverified account would get permission-denied and lose the settings seed
  // and profile write with it.
  it("skips the index, but still seeds settings, when the email is unverified", async () => {
    mockGetDoc.mockResolvedValue(snapshot(false));

    await upsertUserProfile({
      ...user,
      emailVerified: false,
    } as FirebaseAuthTypes.User);

    expect(mockUpsertEmailIndex).not.toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalledWith(
      "users/uid-alice/private/settings",
      expect.objectContaining({ sharePlans: false }),
    );
    expect(profileWrite()).toBeDefined();
  });

  it("does not strip the legacy email if the index write fails", async () => {
    // Losing the index entry and the profile field at once would make the
    // account unsearchable by every client version.
    mockGetDoc.mockResolvedValue(
      snapshot(true, { email: "alice@example.com" }),
    );
    mockUpsertEmailIndex.mockRejectedValue(new Error("offline"));

    await upsertUserProfile(user);

    expect(profileWrite()).toBeUndefined();
    expect(mockNotifyBugsnag).toHaveBeenCalled();
  });

  it("seeds default privacy settings only when they are missing", async () => {
    mockGetDoc.mockImplementation(async (path: string) =>
      path === "users/uid-alice/private/settings"
        ? snapshot(false)
        : snapshot(true),
    );

    await upsertUserProfile(user);

    const settingsWrite = mockSetDoc.mock.calls.find(
      ([path]) => path === "users/uid-alice/private/settings",
    );
    expect(settingsWrite?.[1]).toMatchObject({ sharePlans: false });
  });
});
