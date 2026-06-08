import { useWorkoutPublishMutation } from "../useWorkoutPublishMutation";
import {
  publishStandaloneWorkout,
  unpublishStandaloneWorkout,
} from "@/utils/sharing";
import { useMutation } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

const mockUser = { uid: "user-123" };

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: jest.fn().mockReturnValue(mockUser),
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return { AuthContext: React.createContext(null) };
});
jest.mock("@/utils/sharing", () => ({
  publishStandaloneWorkout: jest.fn(() => Promise.resolve()),
  unpublishStandaloneWorkout: jest.fn(() => Promise.resolve()),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
}));

describe("useWorkoutPublishMutation", () => {
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

  it("mutationFn calls publishStandaloneWorkout when publish is true", async () => {
    useWorkoutPublishMutation(99);
    await capturedArgs.mutationFn(true);
    expect(publishStandaloneWorkout).toHaveBeenCalledWith("user-123", 99);
    expect(unpublishStandaloneWorkout).not.toHaveBeenCalled();
  });

  it("mutationFn calls unpublishStandaloneWorkout when publish is false", async () => {
    useWorkoutPublishMutation(99);
    await capturedArgs.mutationFn(false);
    expect(unpublishStandaloneWorkout).toHaveBeenCalledWith("user-123", 99);
    expect(publishStandaloneWorkout).not.toHaveBeenCalled();
  });

  it("mutationFn throws when no user", async () => {
    const { useContext } = jest.requireMock("react");
    useContext.mockReturnValueOnce(null);
    useWorkoutPublishMutation(99);
    await expect(capturedArgs.mutationFn(true)).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("onSuccess does not throw", () => {
    useWorkoutPublishMutation(99);
    expect(() => capturedArgs.onSuccess(true)).not.toThrow();
  });

  it("onError notifies Bugsnag", () => {
    useWorkoutPublishMutation(99);
    const error = new Error("publish failed");
    capturedArgs.onError(error);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});
