import { setupAppCheck } from "../initAppCheck";

const mockAppInstance = { name: "mock-app" };
const mockAppCheckInstance = { app: mockAppInstance };
const mockInitializeAppCheck = jest.fn();
const mockGetToken = jest.fn();
const mockConfigure = jest.fn();

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => mockAppInstance),
}));

jest.mock("@react-native-firebase/app-check", () => ({
  initializeAppCheck: (...args: any[]) => mockInitializeAppCheck(...args),
  getToken: (...args: any[]) => mockGetToken(...args),
  ReactNativeFirebaseAppCheckProvider: jest.fn().mockImplementation(() => ({
    configure: mockConfigure,
  })),
}));

let mockAppVariant = "production";
let mockDebugToken: string | undefined;

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return {
        extra: { appVariant: mockAppVariant, appCheckDebugToken: mockDebugToken },
      };
    },
  },
}));

describe("setupAppCheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppVariant = "production";
    mockDebugToken = undefined;
    mockInitializeAppCheck.mockResolvedValue(mockAppCheckInstance);
    mockGetToken.mockResolvedValue({ token: "test-token" });
  });

  it("calls initializeAppCheck then getToken with the returned instance", async () => {
    await setupAppCheck();

    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    expect(mockGetToken).toHaveBeenCalledWith(mockAppCheckInstance);
  });

  it("does not resolve before getToken resolves", async () => {
    let resolveGetToken!: () => void;
    mockGetToken.mockReturnValueOnce(
      new Promise<{ token: string }>((resolve) => {
        resolveGetToken = () => resolve({ token: "abc" });
      }),
    );

    let resolved = false;
    const promise = setupAppCheck().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    resolveGetToken();
    await promise;
    expect(resolved).toBe(true);
  });

  it("throws if getToken fails", async () => {
    mockGetToken.mockRejectedValueOnce(new Error("Play Integrity unavailable"));

    await expect(setupAppCheck()).rejects.toThrow("Play Integrity unavailable");
  });

  it("uses playIntegrity provider on production builds", async () => {
    await setupAppCheck();

    expect(mockConfigure).toHaveBeenCalledWith(
      expect.objectContaining({
        android: expect.objectContaining({ provider: "playIntegrity" }),
        apple: expect.objectContaining({ provider: "appAttestWithDeviceCheckFallback" }),
      }),
    );
  });

  it("uses debug provider with token on development builds", async () => {
    mockAppVariant = "development";
    mockDebugToken = "debug-token-abc";

    await setupAppCheck();

    expect(mockConfigure).toHaveBeenCalledWith(
      expect.objectContaining({
        android: expect.objectContaining({
          provider: "debug",
          debugToken: "debug-token-abc",
        }),
      }),
    );
  });
});
