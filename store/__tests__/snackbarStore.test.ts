import { useSnackbarStore, showSnackbar } from "../snackbarStore";

const state = () => useSnackbarStore.getState();

describe("snackbarStore", () => {
  beforeEach(() => {
    useSnackbarStore.setState({ current: null });
  });

  it("shows a message", () => {
    showSnackbar("Backup complete.");
    expect(state().current?.message).toBe("Backup complete.");
  });

  it("runs the action and reports the close as action-taken", () => {
    const onPress = jest.fn();
    const onClose = jest.fn();
    showSnackbar("Workout deleted", {
      action: { label: "Undo", onPress },
      onClose,
    });

    state().pressAction();

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(true);
    expect(state().current).toBeNull();
  });

  it("reports a timeout or swipe as no action taken", () => {
    const onClose = jest.fn();
    showSnackbar("Workout deleted", { onClose });

    state().dismiss();

    expect(onClose).toHaveBeenCalledWith(false);
    expect(state().current).toBeNull();
  });

  it("closes the previous snackbar when a new one replaces it", () => {
    const firstClose = jest.fn();
    showSnackbar("First", { onClose: firstClose });
    showSnackbar("Second");

    expect(firstClose).toHaveBeenCalledWith(false);
    expect(state().current?.message).toBe("Second");
  });

  it("calls onClose only once when dismiss follows an action press", () => {
    const onClose = jest.fn();
    showSnackbar("Workout deleted", {
      action: { label: "Undo", onPress: jest.fn() },
      onClose,
    });

    state().pressAction();
    state().dismiss();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
