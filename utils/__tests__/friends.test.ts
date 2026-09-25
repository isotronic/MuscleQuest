import { acceptFriendRequest, searchUserByEmail } from "../friends";

const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockLookupUidByEmail = jest.fn();

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(),
  doc: jest.fn((_db, ...segments) => segments.join("/")),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  writeBatch: jest.fn(() => ({
    set: mockBatchSet,
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
  serverTimestamp: jest.fn().mockReturnValue("__serverTimestamp__"),
  // not used in acceptFriendRequest but required by module
  collection: jest.fn((_db: unknown, ...segments: string[]) =>
    segments.join("/"),
  ),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
}));

jest.mock("../emailIndex", () => ({
  lookupUidByEmail: (...args: unknown[]) => mockLookupUidByEmail(...args),
}));

describe("acceptFriendRequest", () => {
  const fromUid = "friend-uid";
  const myUid = "my-uid";
  const fromProfile = {
    displayName: "Alice",
    photoURL: "https://example.com/alice.jpg",
  };
  const myProfile = {
    displayName: "Bob",
    photoURL: "https://example.com/bob.jpg",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockGetDoc.mockImplementation((path: string) => {
      const profile = path === `users/${fromUid}` ? fromProfile : myProfile;
      return Promise.resolve({ data: () => profile });
    });
  });

  it("writes fresh fromProfile data into my friends doc for fromUid", async () => {
    await acceptFriendRequest(fromUid, myUid);

    expect(mockGetDoc).toHaveBeenCalledWith(`users/${fromUid}`);
    expect(mockGetDoc).toHaveBeenCalledWith(`users/${myUid}`);

    const myFriendDocPath = `users/${myUid}/friends/${fromUid}`;
    const call = mockBatchSet.mock.calls.find(
      ([path]) => path === myFriendDocPath,
    );
    expect(call).toBeDefined();
    expect(call[1]).toEqual({
      since: "__serverTimestamp__",
      displayName: fromProfile.displayName,
      photoURL: fromProfile.photoURL,
    });
  });

  it("writes fresh myProfile data into the friend's doc for myUid", async () => {
    await acceptFriendRequest(fromUid, myUid);

    const friendDocPath = `users/${fromUid}/friends/${myUid}`;
    const call = mockBatchSet.mock.calls.find(
      ([path]) => path === friendDocPath,
    );
    expect(call).toBeDefined();
    expect(call[1]).toEqual({
      since: "__serverTimestamp__",
      displayName: myProfile.displayName,
      photoURL: myProfile.photoURL,
    });
  });

  it("updates the friendRequest status to accepted", async () => {
    await acceptFriendRequest(fromUid, myUid);

    const requestId = `${fromUid}_${myUid}`;
    const call = mockBatchUpdate.mock.calls.find(
      ([path]) => path === `friendRequests/${requestId}`,
    );
    expect(call).toBeDefined();
    expect(call[1]).toEqual({ status: "accepted" });
  });

  it("commits the batch", async () => {
    await acceptFriendRequest(fromUid, myUid);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });
});

describe("searchUserByEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves through emailIndex and hydrates from the profile", async () => {
    mockLookupUidByEmail.mockResolvedValue("uid-alice");
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        displayName: "Alice",
        photoURL: "https://example.com/alice.jpg",
      }),
    });

    const result = await searchUserByEmail(" Alice@Example.com ", "my-uid");

    expect(mockLookupUidByEmail).toHaveBeenCalledWith("alice@example.com");
    expect(result).toEqual({
      uid: "uid-alice",
      displayName: "Alice",
      // The address the caller typed, not one read off the matched profile.
      email: "alice@example.com",
      photoURL: "https://example.com/alice.jpg",
    });
    // /users is not listable any more; the index is the only lookup path.
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it("returns null when the match is the current user", async () => {
    mockLookupUidByEmail.mockResolvedValue("my-uid");

    await expect(
      searchUserByEmail("me@example.com", "my-uid"),
    ).resolves.toBeNull();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it("returns null when the indexed profile is gone", async () => {
    mockLookupUidByEmail.mockResolvedValue("uid-alice");
    mockGetDoc.mockResolvedValue({ exists: () => false });

    await expect(
      searchUserByEmail("alice@example.com", "my-uid"),
    ).resolves.toBeNull();
  });

  it("returns null, without scanning /users, when there is no index entry", async () => {
    mockLookupUidByEmail.mockResolvedValue(null);

    await expect(
      searchUserByEmail("nobody@example.com", "my-uid"),
    ).resolves.toBeNull();
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });
});
