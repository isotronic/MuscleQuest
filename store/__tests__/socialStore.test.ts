import { act } from "@testing-library/react-native";
import { useSocialStore } from "../socialStore";

describe("useSocialStore – updateFriendProfile", () => {
  const alice = {
    uid: "uid-alice",
    displayName: "",
    email: "",
    photoURL: "",
    since: new Date("2024-01-01").getTime(),
  };
  const bob = {
    uid: "uid-bob",
    displayName: "",
    email: "",
    photoURL: "",
    since: new Date("2024-02-01").getTime(),
  };

  beforeEach(() => {
    useSocialStore.setState({ friends: [alice, bob] });
  });

  it("updates displayName, email and photoURL for the matching uid", () => {
    act(() => {
      useSocialStore.getState().updateFriendProfile("uid-alice", {
        displayName: "Alice",
        email: "alice@example.com",
        photoURL: "https://example.com/alice.jpg",
      });
    });
    const friends = useSocialStore.getState().friends;
    expect(friends.find((f) => f.uid === "uid-alice")).toMatchObject({
      displayName: "Alice",
      email: "alice@example.com",
      photoURL: "https://example.com/alice.jpg",
    });
  });

  it("does not modify other friends", () => {
    act(() => {
      useSocialStore.getState().updateFriendProfile("uid-alice", {
        displayName: "Alice",
        email: "alice@example.com",
        photoURL: "",
      });
    });
    expect(
      useSocialStore.getState().friends.find((f) => f.uid === "uid-bob"),
    ).toEqual(bob);
  });
});

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
