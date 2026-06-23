import { acceptFriendRequest } from "../friends";

const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();

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
  collection: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
}));

describe("acceptFriendRequest", () => {
  const fromUid = "friend-uid";
  const myUid = "my-uid";
  const fromProfile = {
    displayName: "Alice",
    email: "alice@example.com",
    photoURL: "https://example.com/alice.jpg",
  };
  const myProfile = {
    displayName: "Bob",
    email: "bob@example.com",
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
    expect(call[1]).toMatchObject({
      since: "__serverTimestamp__",
      displayName: fromProfile.displayName,
      email: fromProfile.email,
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
    expect(call[1]).toMatchObject({
      since: "__serverTimestamp__",
      displayName: myProfile.displayName,
      email: myProfile.email,
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
