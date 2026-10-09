import { signInWithGoogle } from "../auth";
import Bugsnag from "@bugsnag/expo";
import {
  GoogleAuthProvider,
  signInWithCredential,
  getAuth,
} from "@react-native-firebase/auth";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { Alert } from "react-native";

const withCode = (code: string) => Object.assign(new Error(code), { code });

describe("signInWithGoogle", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, "error").mockImplementation();
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      idToken: "testIdToken",
    });
    (signInWithCredential as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("signs in with the Google credential and returns success", async () => {
    const mockCredential = { token: "testCredential" };
    (GoogleAuthProvider.credential as jest.Mock).mockReturnValue(
      mockCredential,
    );

    await expect(signInWithGoogle()).resolves.toEqual({ status: "success" });

    expect(GoogleSignin.hasPlayServices).toHaveBeenCalledWith({
      showPlayServicesUpdateDialog: true,
    });
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith("testIdToken");
    const authInstance = (getAuth as jest.Mock).mock.results[0].value;
    expect(signInWithCredential).toHaveBeenCalledWith(
      authInstance,
      mockCredential,
    );
  });

  it("returns cancelled without reporting when the user backs out", async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue(
      withCode(statusCodes.SIGN_IN_CANCELLED),
    );

    await expect(signInWithGoogle()).resolves.toEqual({ status: "cancelled" });
    expect(Bugsnag.notify).not.toHaveBeenCalled();
  });

  it("returns offline without starting when the device is offline", async () => {
    const result = await signInWithGoogle({ isOnline: false });

    expect(result).toMatchObject({ status: "error", reason: "offline" });
    expect(GoogleSignin.hasPlayServices).not.toHaveBeenCalled();
    expect(Bugsnag.notify).not.toHaveBeenCalled();
  });

  it.each([
    [statusCodes.PLAY_SERVICES_NOT_AVAILABLE, "playServicesMissing"],
    [statusCodes.IN_PROGRESS, "inProgress"],
    ["auth/network-request-failed", "offline"],
    ["auth/account-exists-with-different-credential", "accountConflict"],
  ])("maps %s to %s without reporting it", async (code, reason) => {
    const error = withCode(code);
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue(error);

    await expect(signInWithGoogle()).resolves.toEqual({
      status: "error",
      reason,
      error,
    });
    expect(Bugsnag.notify).not.toHaveBeenCalled();
  });

  it("maps hasPlayServices resolving false to playServicesMissing", async () => {
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(false);

    const result = await signInWithGoogle();

    expect(result).toMatchObject({
      status: "error",
      reason: "playServicesMissing",
    });
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
  });

  it("maps anything else to unknown and reports it with metadata", async () => {
    const error = withCode("test-code");
    error.name = "TestError";
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue(error);
    const mockEvent = { addMetadata: jest.fn() };
    (Bugsnag.notify as jest.Mock).mockImplementation((_error, callback) => {
      callback(mockEvent);
    });

    await expect(signInWithGoogle()).resolves.toEqual({
      status: "error",
      reason: "unknown",
      error,
    });
    expect(Bugsnag.notify).toHaveBeenCalledTimes(1);
    expect(mockEvent.addMetadata).toHaveBeenCalledWith("sign_in_error", {
      code: "test-code",
      name: "TestError",
    });
  });

  it("redacts email addresses from the reported message", async () => {
    const error = withCode("test-code");
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue(error);
    const reported = {
      errorMessage: "Account jane.doe@example.com is not allowed",
    };
    const mockEvent = { addMetadata: jest.fn(), errors: [reported] };
    (Bugsnag.notify as jest.Mock).mockImplementation((_error, callback) => {
      callback(mockEvent);
    });

    await signInWithGoogle();

    expect(reported.errorMessage).toBe("Account [email] is not allowed");
  });

  it("never shows an alert itself", async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue(new Error("boom"));

    await signInWithGoogle();

    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
