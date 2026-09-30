import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import { useGoogleSignIn } from "../useGoogleSignIn";
import { signInWithGoogle } from "@/utils/auth";
import { useIsOnline } from "../useIsOnline";

// Stands in for a non-English catalog: every message that goes through `t`
// comes back marked, so an untranslated literal would fail the assertions.
jest.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => `[de] ${strings[0]}`,
}));
jest.mock("@/utils/auth", () => ({ signInWithGoogle: jest.fn() }));
jest.mock("../useIsOnline", () => ({ useIsOnline: jest.fn(() => true) }));

const mockSignIn = signInWithGoogle as jest.Mock;
const failWith = (reason: string) =>
  mockSignIn.mockResolvedValue({ status: "error", reason, error: null });

describe("useGoogleSignIn", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useIsOnline as jest.Mock).mockReturnValue(true);
  });

  it("returns the result and shows nothing on success", async () => {
    mockSignIn.mockResolvedValue({ status: "success" });
    const { result } = renderHook(() => useGoogleSignIn());

    let outcome;
    await act(async () => {
      outcome = await result.current.signIn();
    });

    expect(outcome).toEqual({ status: "success" });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(result.current.isSigningIn).toBe(false);
  });

  it("passes the connection state to signInWithGoogle", async () => {
    (useIsOnline as jest.Mock).mockReturnValue(false);
    failWith("offline");
    const { result } = renderHook(() => useGoogleSignIn());

    await act(async () => {
      await result.current.signIn();
    });

    expect(mockSignIn).toHaveBeenCalledWith({ isOnline: false });
    expect(result.current.isOnline).toBe(false);
  });

  it.each([
    [
      "offline",
      "[de] You're offline. Connect to the internet to sign in. You can keep training without signing in.",
    ],
    [
      "playServicesMissing",
      "[de] Google sign-in needs Google Play Services, which isn't available on this device. You can keep using MuscleQuest without signing in.",
    ],
    [
      "accountConflict",
      "[de] This email is already linked to a different sign-in method.",
    ],
    [
      "unknown",
      "[de] Couldn't sign in. Try again in a moment. If it keeps happening, contact support from Help.",
    ],
  ])("shows a localised message for %s", async (reason, message) => {
    failWith(reason);
    const { result } = renderHook(() => useGoogleSignIn());

    await act(async () => {
      await result.current.signIn();
    });

    expect(Alert.alert).toHaveBeenCalledWith("[de] Sign-in failed", message, [
      { text: "[de] OK" },
    ]);
  });

  it("shows nothing when cancelled", async () => {
    mockSignIn.mockResolvedValue({ status: "cancelled" });
    const { result } = renderHook(() => useGoogleSignIn());

    await act(async () => {
      await result.current.signIn();
    });

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("shows nothing when a sign-in is already in progress", async () => {
    failWith("inProgress");
    const { result } = renderHook(() => useGoogleSignIn());

    await act(async () => {
      await result.current.signIn();
    });

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("starts one sign-in on a double press and reports pending state", async () => {
    let resolve: (v: unknown) => void = () => {};
    mockSignIn.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { result } = renderHook(() => useGoogleSignIn());

    let first: Promise<unknown> = Promise.resolve();
    await act(async () => {
      first = result.current.signIn();
      void result.current.signIn();
    });

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(result.current.isSigningIn).toBe(true);

    await act(async () => {
      resolve({ status: "success" });
      await first;
    });
    expect(result.current.isSigningIn).toBe(false);
  });
});
