import { router } from "expo-router";
import { openPlanOverview } from "../planNavigation";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

const href = {
  pathname: "/(app)/(tabs)/(plans)/overview",
  params: { planId: "4" },
};

describe("openPlanOverview", () => {
  beforeEach(() => jest.clearAllMocks());

  // Without the anchor the overview becomes the root of an unmounted Plans
  // stack, with no way back to the list.
  it("pushes the overview with the plans list anchored under it", () => {
    openPlanOverview(4);
    expect(router.push).toHaveBeenCalledWith(href, { withAnchor: true });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("replaces the current screen when asked", () => {
    openPlanOverview(4, { replace: true });
    expect(router.replace).toHaveBeenCalledWith(href, { withAnchor: true });
    expect(router.push).not.toHaveBeenCalled();
  });
});
