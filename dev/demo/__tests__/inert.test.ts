// Demo mode does nothing unless this is the dev variant, even when the
// module is loaded.
import { runStartupSeed } from "../index";
import { isDemoActive, isDemoBuild, isDemoUid, setDemoActive } from "../state";

const mockOpenDatabase = jest.fn();
const mockExtra: { appVariant?: string } = {};

jest.mock("@/utils/db/connection", () => ({
  openDatabase: (...args: unknown[]) => mockOpenDatabase(...args),
}));
jest.mock("@/utils/database", () => jest.requireActual("@/utils/database"));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra };
    },
  },
}));
jest.mock("../DemoDataSection", () => ({ DemoDataSection: () => null }));

afterEach(() => setDemoActive(false));

describe.each(["production", "preview", undefined])(
  "with appVariant %s",
  (variant) => {
    beforeEach(() => {
      mockExtra.appVariant = variant;
    });

    it("never seeds or opens the database", async () => {
      expect(isDemoBuild()).toBe(false);
      expect(await runStartupSeed()).toEqual({ status: "inactive" });
      expect(mockOpenDatabase).not.toHaveBeenCalled();
    });

    it("never treats a uid as a demo friend", () => {
      setDemoActive(true);
      expect(isDemoActive()).toBe(false);
      expect(isDemoUid("demo-maya")).toBe(false);
    });
  },
);

describe("the build-time gate", () => {
  const originalFlag = process.env.EXPO_PUBLIC_DEMO_DATA;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_DEMO_DATA;
    else process.env.EXPO_PUBLIC_DEMO_DATA = originalFlag;
  });

  it("loads nothing without EXPO_PUBLIC_DEMO_DATA=1", () => {
    delete process.env.EXPO_PUBLIC_DEMO_DATA;
    jest.isolateModules(() => {
      expect(require("../gate").demoMode).toBeNull();
    });
  });
});
