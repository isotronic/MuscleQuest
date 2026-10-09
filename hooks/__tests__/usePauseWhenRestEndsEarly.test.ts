import { act, renderHook } from "@testing-library/react-native";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { usePauseWhenRestEndsEarly } from "../usePauseWhenRestEndsEarly";

const inSeconds = (s: number) => new Date(Date.now() + s * 1000);

const setup = () => {
  const pause = jest.fn();
  act(() => useActiveWorkoutStore.getState().startTimer(inSeconds(0.5)));
  renderHook(() => usePauseWhenRestEndsEarly(pause));
  return pause;
};

describe("usePauseWhenRestEndsEarly", () => {
  it("pauses a rest ended early, even in its last second", () => {
    const pause = setup();
    expect(pause).not.toHaveBeenCalled();
    act(() => useActiveWorkoutStore.getState().endRestEarly());
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("leaves a rest that ran out to reach its own expiry", () => {
    const pause = setup();
    act(() => useActiveWorkoutStore.getState().stopTimer());
    expect(pause).not.toHaveBeenCalled();
  });

  it("clears the early end when the next rest starts", () => {
    const pause = setup();
    act(() => useActiveWorkoutStore.getState().endRestEarly());
    act(() => useActiveWorkoutStore.getState().startTimer(inSeconds(90)));
    expect(useActiveWorkoutStore.getState().restEndedEarly).toBe(false);
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
