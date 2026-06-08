import { act } from "@testing-library/react-native";
import { useSocialStore } from "../socialStore";

describe("useSocialStore – published IDs", () => {
  beforeEach(() => {
    useSocialStore.setState({
      publishedPlanIds: null,
      publishedWorkoutIds: null,
    });
  });

  it("initial publishedPlanIds is null", () => {
    expect(useSocialStore.getState().publishedPlanIds).toBeNull();
  });

  it("initial publishedWorkoutIds is null", () => {
    expect(useSocialStore.getState().publishedWorkoutIds).toBeNull();
  });

  it("setPublishedPlanIds updates the store", () => {
    act(() => {
      useSocialStore.getState().setPublishedPlanIds(["1", "2"]);
    });
    expect(useSocialStore.getState().publishedPlanIds).toEqual(["1", "2"]);
  });

  it("setPublishedWorkoutIds updates the store", () => {
    act(() => {
      useSocialStore.getState().setPublishedWorkoutIds(["99"]);
    });
    expect(useSocialStore.getState().publishedWorkoutIds).toEqual(["99"]);
  });

  it("setPublishedPlanIds accepts null to reset to loading state", () => {
    act(() => {
      useSocialStore.getState().setPublishedPlanIds(["1"]);
      useSocialStore.getState().setPublishedPlanIds(null);
    });
    expect(useSocialStore.getState().publishedPlanIds).toBeNull();
  });

  it("setPublishedWorkoutIds accepts null to reset to loading state", () => {
    act(() => {
      useSocialStore.getState().setPublishedWorkoutIds(["1"]);
      useSocialStore.getState().setPublishedWorkoutIds(null);
    });
    expect(useSocialStore.getState().publishedWorkoutIds).toBeNull();
  });
});
