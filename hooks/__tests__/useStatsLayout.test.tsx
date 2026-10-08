import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdateStatsLayoutMutation } from "../useStatsLayout";
import { updateSettings } from "@/utils/database";
import { defaultStatsLayout, setWidgetVisible } from "@/utils/statsLayout";

jest.mock("@/utils/database", () => ({
  updateSettings: jest.fn(),
  fetchSettings: jest.fn(),
}));

const mockUpdate = updateSettings as jest.Mock;

let clients: QueryClient[] = [];

const setup = () => {
  const queryClient = new QueryClient({
    // No garbage collection timers, which would hold Jest open.
    defaultOptions: {
      queries: { gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(queryClient);
  queryClient.setQueryData(["settings"], { weightUnit: "kg" });
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUpdateStatsLayoutMutation(), {
    wrapper,
  });
  return { queryClient, invalidate, result };
};

describe("useUpdateStatsLayoutMutation", () => {
  beforeEach(() => mockUpdate.mockReset());
  afterEach(() => {
    clients.forEach((client) => client.clear());
    clients = [];
  });

  it("writes quick saves one at a time, in order, and refetches once after the last", async () => {
    const pending: (() => void)[] = [];
    const writes: string[] = [];
    mockUpdate.mockImplementation(
      (_key: string, value: string) =>
        new Promise<void>((resolve) => {
          writes.push(value);
          pending.push(resolve);
        }),
    );
    const { queryClient, invalidate, result } = setup();
    const first = setWidgetVisible(defaultStatsLayout(), "heatmap", false);
    const second = setWidgetVisible(first, "summary", false);

    act(() => {
      result.current.save(first);
      result.current.save(second);
    });

    // The second write waits for the first.
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toBe(JSON.stringify(first));

    await act(async () => pending[0]());
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toBe(JSON.stringify(second));
    // The first save settled while the second was queued: no refetch yet.
    expect(invalidate).not.toHaveBeenCalled();

    await act(async () => pending[1]());
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["settings"] }),
    );
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(
      queryClient.getQueryData<{ statsLayout: string }>(["settings"])!
        .statsLayout,
    ).toBe(JSON.stringify(second));
  });

  it("rolls back the cache and still refetches when a save fails", async () => {
    mockUpdate.mockRejectedValue(new Error("disk full"));
    const { queryClient, invalidate, result } = setup();

    act(() => result.current.save(defaultStatsLayout()));

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryData(["settings"])).toEqual({
      weightUnit: "kg",
    });
  });

  it("keeps a queued edit in the cache when an earlier save fails", async () => {
    const pending: { resolve: () => void; reject: (e: Error) => void }[] = [];
    const writes: string[] = [];
    mockUpdate.mockImplementation(
      (_key: string, value: string) =>
        new Promise<void>((resolve, reject) => {
          writes.push(value);
          pending.push({ resolve, reject });
        }),
    );
    const { queryClient, invalidate, result } = setup();
    const first = setWidgetVisible(defaultStatsLayout(), "heatmap", false);
    const second = setWidgetVisible(first, "summary", false);
    const cachedLayout = () =>
      queryClient.getQueryData<{ statsLayout?: string }>(["settings"])
        ?.statsLayout;

    act(() => {
      result.current.save(first);
      result.current.save(second);
    });
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(cachedLayout()).toBe(JSON.stringify(second));

    await act(async () => pending[0].reject(new Error("disk full")));

    // The queued edit is still shown and is the next write.
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(cachedLayout()).toBe(JSON.stringify(second));
    expect(writes[1]).toBe(JSON.stringify(second));
    expect(invalidate).not.toHaveBeenCalled();

    await act(async () => pending[1].resolve());
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    expect(cachedLayout()).toBe(JSON.stringify(second));
  });
});
