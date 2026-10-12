import { PREMADE_PLAN_META } from "@/constants/premadePlanMeta";
import { rankPremadePlans } from "../planPicker";

jest.mock("@lingui/core/macro", () => ({
  msg: (s: TemplateStringsArray) => s[0],
}));

const top = (answers: Parameters<typeof rankPremadePlans>[0], n = 2) =>
  rankPremadePlans(answers, PREMADE_PLAN_META)
    .slice(0, n)
    .map((p) => p.appPlanId);

describe("rankPremadePlans", () => {
  it("ranks the 3-day full body plan first for 3 days, beginner, gym", () => {
    const [first] = rankPremadePlans(
      { days: 3, level: "beginner", equipment: "gym" },
      PREMADE_PLAN_META,
    );
    expect(first).toEqual({
      appPlanId: 1,
      matches: { days: true, level: true, equipment: true },
    });
  });

  it("never puts a plan that needs missing equipment ahead of one that fits", () => {
    // Only the bodyweight plan needs nothing.
    expect(top({ days: 6, level: "advanced", equipment: "none" }, 1)).toEqual([
      5,
    ]);
    // The dumbbell and bodyweight plans, then the gym plans.
    const ranked = rankPremadePlans(
      { days: 4, level: "intermediate", equipment: "dumbbells" },
      PREMADE_PLAN_META,
    ).map((p) => p.appPlanId);
    expect(ranked.slice(0, 2)).toEqual([6, 5]);
  });

  it("prefers fewer days than available over more", () => {
    // The 4-day plans match; a 5-day plan cannot be done in full.
    expect(top({ days: 4, level: "intermediate", equipment: "gym" })).toEqual([
      2, 6,
    ]);
    expect(top({ days: 2, level: "beginner", equipment: "gym" })).toEqual([
      1, 5,
    ]);
  });

  it("matches level among plans with the same days", () => {
    expect(top({ days: 6, level: "advanced", equipment: "gym" }, 1)).toEqual([
      4,
    ]);
    expect(top({ days: 5, level: "intermediate", equipment: "gym" })).toEqual([
      3, 7,
    ]);
  });
});
