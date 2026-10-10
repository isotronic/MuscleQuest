import { displayWorkoutName } from "../workoutName";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) =>
    "[de] " + String.raw({ raw: s }, ...v),
}));

describe("displayWorkoutName", () => {
  it("translates the stored Quick Workout name", () => {
    expect(displayWorkoutName("Quick Workout")).toBe("[de] Quick workout");
  });

  it("names a workout without a name as a Quick Workout", () => {
    expect(displayWorkoutName(null)).toBe("[de] Quick workout");
    expect(displayWorkoutName("")).toBe("[de] Quick workout");
  });

  it("passes other names through", () => {
    expect(displayWorkoutName("Push Day")).toBe("Push Day");
  });
});
