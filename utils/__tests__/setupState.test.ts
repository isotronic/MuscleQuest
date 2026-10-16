import { onboardingRedirect, SetupState } from "../setupState";

describe("onboardingRedirect", () => {
  it("sends a new install to the welcome screen before sign-in", () => {
    expect(onboardingRedirect({ setupDone: SetupState.pending })).toBe(
      "/welcome",
    );
  });

  it("sends a finished setup without sign-in to the login screen", () => {
    expect(onboardingRedirect({ setupDone: SetupState.done })).toBe("/login");
  });

  it("lets a finished onboarding through", () => {
    expect(
      onboardingRedirect({ setupDone: SetupState.done, loginShown: "true" }),
    ).toBeNull();
  });

  it("lets an older install with the setup card through", () => {
    expect(
      onboardingRedirect({ setupDone: SetupState.offered, loginShown: "true" }),
    ).toBeNull();
  });

  it("waits while settings are loading", () => {
    expect(onboardingRedirect(undefined)).toBeNull();
  });
});
