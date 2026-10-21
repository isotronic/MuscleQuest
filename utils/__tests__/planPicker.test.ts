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

  it("leaves out plans that need equipment the user lacks", () => {
    // Only the bodyweight plan needs nothing.
    expect(top({ days: 6, level: "advanced", equipment: "none" })).toEqual([5]);
    expect(
      top({ days: 4, level: "intermediate", equipment: "dumbbells" }, 7),
    ).toEqual([6, 5]);
  });

  it("prefers fewer days than available over more", () => {
    // The 4-day plans match; a 5-day plan cannot be done in full.
    expect(top({ days: 4, level: "intermediate", equipment: "gym" })).toEqual([
      2, 6,
    ]);
    // The 2-day plan matches; after it, 3-day plans beat the 4-day ones.
    expect(top({ days: 2, level: "beginner", equipment: "gym" }, 3)).toEqual([
      10, 1, 8,
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
