import { signInWithGoogle } from "../auth";
import Bugsnag from "@bugsnag/expo";
import {
  GoogleAuthProvider,
  signInWithCredential,
  getAuth,
} from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Alert } from "react-native";

describe("signInWithGoogle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should sign in successfully with Google credentials", async () => {
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      idToken: "testIdToken",
    });
    const mockCredential = { token: "testCredential" };
    (GoogleAuthProvider.credential as jest.Mock).mockReturnValue(
      mockCredential,
    );
    (signInWithCredential as jest.Mock).mockResolvedValue(null);

    await signInWithGoogle();

    expect(GoogleSignin.hasPlayServices).toHaveBeenCalledWith({
      showPlayServicesUpdateDialog: true,
    });
    expect(GoogleSignin.signIn).toHaveBeenCalled();
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith("testIdToken");
    expect(getAuth).toHaveBeenCalled();
    const authInstance = (getAuth as jest.Mock).mock.results[0].value;
    expect(signInWithCredential).toHaveBeenCalledWith(
      authInstance,
      mockCredential,
    );
  });

  it("should throw an error if play services are not available", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(false);

    await expect(signInWithGoogle()).rejects.toThrow(
      "Play services not available",
    );

    expect(GoogleSignin.hasPlayServices).toHaveBeenCalled();
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
    consoleSpy.mockRestore(); // Restore original console.error
  });

  it("should handle user cancellation gracefully and notify Bugsnag", async () => {
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue({ code: "12501" });

    await expect(signInWithGoogle()).rejects.toEqual({ code: "12501" });

    expect(GoogleSignin.signIn).toHaveBeenCalled();
    expect(Bugsnag.notify).toHaveBeenCalledWith(
      expect.objectContaining({ code: "12501" }),
      expect.any(Function),
    ); // Ensure cancellation is logged
    expect(Alert.alert).not.toHaveBeenCalled(); // No alert for cancellations
  });

  it("should notify Bugsnag and show an alert for other errors", async () => {
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
    const mockError = new Error("Sign-in error");
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue(mockError);

    await expect(signInWithGoogle()).rejects.toThrow("Sign-in error");

    expect(Bugsnag.notify).toHaveBeenCalledWith(
      mockError,
      expect.any(Function),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      "Error",
      "Failed to sign in. Please try again.",
    );
  });

  it("should add sign_in_error metadata to Bugsnag notification", async () => {
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
    const mockError = new Error("Sign-in error");
    mockError.name = "TestError";
    (mockError as any).code = "test-code";
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue(mockError);

    const mockEvent = {
      addMetadata: jest.fn(),
    };
    (Bugsnag.notify as jest.Mock).mockImplementation((error, callback) => {
      callback(mockEvent);
    });

    await expect(signInWithGoogle()).rejects.toThrow("Sign-in error");

    expect(mockEvent.addMetadata).toHaveBeenCalledWith("sign_in_error", {
      code: "test-code",
      message: "Sign-in error",
      name: "TestError",
      stack: expect.any(String),
    });
  });
});
