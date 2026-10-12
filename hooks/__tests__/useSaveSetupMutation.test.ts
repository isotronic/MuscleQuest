import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSaveSetupMutation } from "../useSaveSetupMutation";

jest.mock("@/utils/database", () => ({ saveSetupChanges: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

describe("useSaveSetupMutation", () => {
  it("resolves only once the settings query has refetched", async () => {
    let finishRefetch = () => {};
    const invalidateQueries = jest.fn(({ queryKey }) =>
      queryKey[0] === "settings"
        ? new Promise<void>((resolve) => (finishRefetch = resolve))
        : Promise.resolve(),
    );
    (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });
    let options: any;
    (useMutation as jest.Mock).mockImplementation((o) => (options = o));

    useSaveSetupMutation();
    let settled = false;
    const success = Promise.resolve(options.onSuccess()).then(
      () => (settled = true),
    );

    // The (app) layout reads setupDone from that query: until it refetches,
    // it would still send the user back to setup.
    await Promise.resolve();
    expect(settled).toBe(false);
    finishRefetch();
    await success;
    expect(settled).toBe(true);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["completedWorkouts"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bodyMeasurements"],
    });
  });
});
