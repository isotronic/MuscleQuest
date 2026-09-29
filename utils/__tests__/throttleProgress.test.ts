import { throttleProgress } from "../throttleProgress";
import type { StartupProgress } from "../startup";

jest.mock("../startup", () => ({}));

const p = (stage: StartupProgress["stage"], done: number, total: number) => ({
  stage,
  done,
  total,
});

describe("throttleProgress", () => {
  let now = 0;
  const clock = () => now;

  beforeEach(() => {
    now = 1000;
  });

  it("passes the first update straight through", () => {
    const fn = jest.fn();
    throttleProgress(fn, 100, clock)(p("exercises", 0, 780));
    expect(fn).toHaveBeenCalledWith(p("exercises", 0, 780));
  });

  it("drops updates that arrive within the interval", () => {
    const fn = jest.fn();
    const report = throttleProgress(fn, 100, clock);
    report(p("exercises", 0, 780));
    now += 40;
    report(p("exercises", 50, 780));
    now += 70;
    report(p("exercises", 100, 780));
    expect(fn.mock.calls.map(([x]) => x.done)).toEqual([0, 100]);
  });

  it("always passes a finished stage and a stage change", () => {
    const fn = jest.fn();
    const report = throttleProgress(fn, 100, clock);
    report(p("exercises", 750, 780));
    report(p("exercises", 780, 780));
    report(p("plans", 0, 7));
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
