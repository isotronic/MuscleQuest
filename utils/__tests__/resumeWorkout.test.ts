import { router } from "expo-router";
import { resumeActiveWorkout } from "../resumeWorkout";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useStaleWorkoutPromptStore } from "@/store/staleWorkoutPromptStore";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

const HOUR = 60 * 60 * 1000;

describe("resumeActiveWorkout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStaleWorkoutPromptStore.setState({ visible: false });
    useActiveWorkoutStore.setState({ savedCompletedWorkoutId: null });
  });

  it("opens the summary, not the session, when the workout was already saved", () => {
    useActiveWorkoutStore.setState({
      startTime: new Date(Date.now() - 30 * HOUR),
      lastActivityAt: new Date(Date.now() - 29 * HOUR),
      savedCompletedWorkoutId: 42,
    });

    resumeActiveWorkout();

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(app)/(workout)/workout-summary",
      params: { completedWorkoutId: "42", fresh: "true" },
    });
    expect(useStaleWorkoutPromptStore.getState().visible).toBe(false);
  });

  it("navigates straight in when the last activity was within four hours", () => {
    useActiveWorkoutStore.setState({
      startTime: new Date(Date.now() - 5 * HOUR),
      lastActivityAt: new Date(Date.now() - 1 * HOUR),
    });

    resumeActiveWorkout();

    expect(router.push).toHaveBeenCalledWith("/(app)/(workout)");
    expect(useStaleWorkoutPromptStore.getState().visible).toBe(false);
  });

  it("asks first when the last activity was more than four hours ago", () => {
    useActiveWorkoutStore.setState({
      startTime: new Date(Date.now() - 30 * HOUR),
      lastActivityAt: new Date(Date.now() - 29 * HOUR),
    });

    resumeActiveWorkout();

    expect(router.push).not.toHaveBeenCalled();
    expect(useStaleWorkoutPromptStore.getState().visible).toBe(true);
  });

  it("asks first for an old persisted workout with no lastActivityAt", () => {
    useActiveWorkoutStore.setState({
      startTime: new Date(Date.now() - 30 * HOUR),
      lastActivityAt: null,
    });

    resumeActiveWorkout();

    expect(router.push).not.toHaveBeenCalled();
    expect(useStaleWorkoutPromptStore.getState().visible).toBe(true);
  });
});
