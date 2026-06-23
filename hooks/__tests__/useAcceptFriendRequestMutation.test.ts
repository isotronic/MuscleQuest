import { useAcceptFriendRequestMutation } from "../useAcceptFriendRequestMutation";
import { acceptFriendRequest } from "@/utils/friends";
import { useMutation } from "@tanstack/react-query";

const mockUser = {
  uid: "my-uid",
  displayName: "Bob",
  email: "bob@example.com",
  photoURL: "https://example.com/bob.jpg",
};

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: jest.fn().mockReturnValue(mockUser),
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return { AuthContext: React.createContext(null) };
});
jest.mock("@/utils/friends", () => ({
  acceptFriendRequest: jest.fn(() => Promise.resolve()),
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
}));

describe("useAcceptFriendRequestMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { useContext } = jest.requireMock("react");
    useContext.mockReturnValue(mockUser);
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("calls acceptFriendRequest with fromUid and myUid", async () => {
    useAcceptFriendRequestMutation();
    await capturedArgs.mutationFn({ fromUid: "friend-uid" });
    expect(acceptFriendRequest).toHaveBeenCalledWith("friend-uid", "my-uid");
  });

  it("throws when no user", async () => {
    const { useContext } = jest.requireMock("react");
    useContext.mockReturnValueOnce(null);
    useAcceptFriendRequestMutation();
    await expect(
      capturedArgs.mutationFn({ fromUid: "friend-uid" }),
    ).rejects.toThrow("Not authenticated");
  });
});
