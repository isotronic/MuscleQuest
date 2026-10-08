import { restoreConfirmMessage } from "../restoreConfirmMessage";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));

const DISCARD = "Your workout in progress will be discarded.";

describe("restoreConfirmMessage", () => {
  it("names the backup date and warns about a workout in progress", () => {
    const message = restoreConfirmMessage("1/3/2026", true);
    expect(message).toContain("1/3/2026");
    expect(message).toContain(DISCARD);
  });

  it("does not mention a workout when none is in progress", () => {
    expect(restoreConfirmMessage("1/3/2026", false)).not.toContain(DISCARD);
    expect(restoreConfirmMessage(undefined, false)).not.toContain(DISCARD);
  });

  it("warns without a backup date too", () => {
    expect(restoreConfirmMessage(undefined, true)).toContain(DISCARD);
  });
});
