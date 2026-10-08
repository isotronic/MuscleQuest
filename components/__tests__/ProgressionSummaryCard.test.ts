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
});
