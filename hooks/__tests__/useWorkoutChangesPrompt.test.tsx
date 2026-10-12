import React from "react";
import { act, render } from "@testing-library/react-native";
import { useWorkoutChangesPrompt } from "../useWorkoutChangesPrompt";

let lastDialog: any;
jest.mock("@/components/WorkoutChangesDialog", () => ({
  WorkoutChangesDialog: (props: any) => {
    lastDialog = props;
    return null;
  },
}));

const change = { id: "order", kind: "reordered" } as const;

function setup() {
  const api: { current?: ReturnType<typeof useWorkoutChangesPrompt> } = {};
  function Host() {
    api.current = useWorkoutChangesPrompt();
    return api.current.prompt;
  }
  render(<Host />);
  return api as Required<typeof api>;
}

describe("useWorkoutChangesPrompt", () => {
  it("opens the dialog and settles with the answer", async () => {
    const api = setup();
    expect(lastDialog.visible).toBe(false);

    let answer: Promise<string[] | null>;
    act(() => {
      answer = api.current.ask({ changes: [change], isPlan: true });
    });
    expect(lastDialog).toEqual(
      expect.objectContaining({
        visible: true,
        isPlan: true,
        changes: [change],
      }),
    );

    act(() => lastDialog.onDone(["order"]));
    await expect(answer!).resolves.toEqual(["order"]);
    expect(lastDialog.visible).toBe(false);
  });

  it("answers an earlier open question with keep", async () => {
    const api = setup();
    let first: Promise<string[] | null>;
    act(() => {
      first = api.current.ask({ changes: [change], isPlan: true });
    });
    act(() => {
      void api.current.ask({ changes: [change], isPlan: false });
    });
    await expect(first!).resolves.toBeNull();
  });
});
