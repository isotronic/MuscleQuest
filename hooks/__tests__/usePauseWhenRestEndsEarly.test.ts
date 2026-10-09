import { renderHook } from "@testing-library/react-native";
import { usePauseWhenRestEndsEarly } from "../usePauseWhenRestEndsEarly";

const inSeconds = (s: number) => new Date(Date.now() + s * 1000);

const setup = (expiry: Date | null) => {
  const pause = jest.fn();
  const ref = { current: expiry };
  const view = renderHook(
    ({ running }: { running: boolean }) =>
      usePauseWhenRestEndsEarly(running, ref, pause),
    { initialProps: { running: true } },
  );
  return { pause, stop: () => view.rerender({ running: false }) };
};

describe("usePauseWhenRestEndsEarly", () => {
  it("pauses when the rest is stopped well before it runs out", () => {
    const { pause, stop } = setup(inSeconds(90));
    expect(pause).not.toHaveBeenCalled();
    stop();
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("leaves a rest that ran out to reach its own expiry", () => {
    const { pause, stop } = setup(inSeconds(0.5));
    stop();
    expect(pause).not.toHaveBeenCalled();
  });

  it("does nothing without a rest", () => {
    const { pause, stop } = setup(null);
    stop();
    expect(pause).not.toHaveBeenCalled();
  });
});
