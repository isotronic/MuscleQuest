import { getRuleExplanation } from "@/components/ProgressionSummaryCard";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: unknown }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));

describe("getRuleExplanation", () => {
  it("explains the layoff override instead of falling back to the default", () => {
    expect(getRuleExplanation("MUSCLE_LAYOFF")).toBe(
      "It's been a while since you trained this muscle. Start a little lighter to ease back in.",
    );
  });

  it.each([
    ["EASY_TARGET_LOAD", "less assistance"],
    ["MODERATE_TARGET_LOAD", "less assistance"],
    ["FAILED_SETS", "more assistance"],
    ["PAIN_LOAD", "more assistance"],
    ["MUSCLE_LAYOFF", "more assistance"],
  ])("talks about assistance for an assisted %s", (ruleKey, words) => {
    expect(getRuleExplanation(ruleKey, "assisted")).toContain(words);
    expect(getRuleExplanation(ruleKey, "weight")).not.toContain("assistance");
  });

  it("explains when there is no assistance left to take away", () => {
    expect(getRuleExplanation("NO_ASSISTANCE_LEFT", "assisted")).toBe(
      "You're already doing it without assistance. Hold here, or move on to the unassisted version.",
    );
  });
});
