import { usePlanPublishMutation } from "../usePlanPublishMutation";
import { publishPlan, unpublishPlan } from "@/utils/sharing";
import { useMutation } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import { showSnackbar } from "@/store/snackbarStore";
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/store/snackbarStore", () => ({ showSnackbar: jest.fn() }));

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
  publishPlan: jest.fn(() => Promise.resolve()),
  unpublishPlan: jest.fn(() => Promise.resolve()),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
}));

describe("usePlanPublishMutation", () => {
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

  it("mutationFn calls publishPlan when publish is true", async () => {
    usePlanPublishMutation(42);
    await capturedArgs.mutationFn(true);
    expect(publishPlan).toHaveBeenCalledWith("user-123", 42);
    expect(unpublishPlan).not.toHaveBeenCalled();
  });

  it("mutationFn calls unpublishPlan when publish is false", async () => {
    usePlanPublishMutation(42);
    await capturedArgs.mutationFn(false);
    expect(unpublishPlan).toHaveBeenCalledWith("user-123", 42);
    expect(publishPlan).not.toHaveBeenCalled();
  });

  it("mutationFn throws when no user", async () => {
    const { useContext } = jest.requireMock("react");
    useContext.mockReturnValueOnce(null);
    usePlanPublishMutation(42);
    await expect(capturedArgs.mutationFn(true)).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("onSuccess does not throw", () => {
    usePlanPublishMutation(42);
    expect(() => capturedArgs.onSuccess(true)).not.toThrow();
  });

  it("onError notifies Bugsnag", () => {
    usePlanPublishMutation(42);
    const error = new Error("publish failed");
    capturedArgs.onError(error);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });

  it("tells the user when sharing fails", () => {
    usePlanPublishMutation(42);
    capturedArgs.onError(new Error("offline"), true);
    expect(showSnackbar).toHaveBeenCalledWith(
      "Couldn't share this plan. Try again when you're online.",
    );
  });

  it("tells the user when unsharing fails", () => {
    usePlanPublishMutation(42);
    capturedArgs.onError(new Error("offline"), false);
    expect(showSnackbar).toHaveBeenCalledWith(
      "Couldn't stop sharing this plan. Try again when you're online.",
    );
  });
});
