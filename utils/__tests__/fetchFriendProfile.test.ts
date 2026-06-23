import { fetchFriendProfile } from "../fetchFriendProfile";

const mockGetDoc = jest.fn();

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => "db"),
  doc: jest.fn((_db, ...parts) => parts.join("/")),
  getDoc: (...args: any[]) => mockGetDoc(...args),
}));

describe("fetchFriendProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns profile data on first successful attempt", async () => {
    mockGetDoc.mockResolvedValueOnce({
      data: () => ({
        displayName: "Alice",
        email: "alice@example.com",
        photoURL: "https://example.com/alice.jpg",
      }),
    });

    const profile = await fetchFriendProfile("uid-alice");

    expect(profile).toEqual({
      displayName: "Alice",
      email: "alice@example.com",
      photoURL: "https://example.com/alice.jpg",
    });
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  it("retries after failure and returns profile on second attempt", async () => {
    mockGetDoc
      .mockRejectedValueOnce(new Error("permission-denied"))
      .mockResolvedValueOnce({
        data: () => ({
          displayName: "Alice",
          email: "alice@example.com",
          photoURL: "",
        }),
      });

    const promise = fetchFriendProfile("uid-alice", 3, 1000);

    // Advance past the first retry delay (1 × 1000ms)
    await jest.advanceTimersByTimeAsync(1100);

    const profile = await promise;
    expect(profile.displayName).toBe("Alice");
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all attempts", async () => {
    const error = new Error("always fails");
    mockGetDoc.mockRejectedValue(error);

    const promise = fetchFriendProfile("uid-alice", 3, 100);
    promise.catch(() => {}); // Prevent unhandled rejection during timer advance

    await jest.advanceTimersByTimeAsync(500);

    await expect(promise).rejects.toThrow("always fails");
    expect(mockGetDoc).toHaveBeenCalledTimes(3);
  });

  it("defaults missing profile fields to empty strings", async () => {
    mockGetDoc.mockResolvedValueOnce({ data: () => ({}) });

    const profile = await fetchFriendProfile("uid-alice");

    expect(profile).toEqual({ displayName: "", email: "", photoURL: "" });
  });
});
