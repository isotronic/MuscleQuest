import { onlineManager, QueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { isOnlineState, connectOnlineManager } from "@/utils/networkStatus";
import { createAppQueryClient } from "@/utils/queryClient";

jest.mock("@react-native-community/netinfo", () => {
  const listeners: ((s: unknown) => void)[] = [];
  return {
    __esModule: true,
    default: {
      addEventListener: jest.fn((cb: (s: unknown) => void) => {
        listeners.push(cb);
        return () => listeners.splice(listeners.indexOf(cb), 1);
      }),
    },
    mockEmit: (s: unknown) => listeners.forEach((cb) => cb(s)),
  };
});
const { mockEmit } = jest.requireMock("@react-native-community/netinfo") as {
  mockEmit: (s: unknown) => void;
};

describe("isOnlineState", () => {
  it("is online when connected and reachable", () => {
    expect(
      isOnlineState({ isConnected: true, isInternetReachable: true }),
    ).toBe(true);
  });

  it("treats unknown (null) state as online to avoid launch flashes", () => {
    expect(
      isOnlineState({ isConnected: null, isInternetReachable: null }),
    ).toBe(true);
  });

  it("is offline when disconnected", () => {
    expect(
      isOnlineState({ isConnected: false, isInternetReachable: null }),
    ).toBe(false);
  });

  it("is offline when connected but the internet is unreachable", () => {
    expect(
      isOnlineState({ isConnected: true, isInternetReachable: false }),
    ).toBe(false);
  });
});

describe("connectOnlineManager", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("drives React Query's online state from NetInfo", () => {
    connectOnlineManager();
    expect(NetInfo.addEventListener).toHaveBeenCalled();

    mockEmit({ isConnected: false, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false);

    mockEmit({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(true);
  });
});

describe("createAppQueryClient", () => {
  let client: QueryClient;

  afterEach(() => {
    client?.clear();
    onlineManager.setOnline(true);
  });

  it("still runs local (SQLite) queries while offline", async () => {
    client = createAppQueryClient(jest.fn());
    onlineManager.setOnline(false);
    const data = await client.fetchQuery({
      queryKey: ["local"],
      queryFn: async () => "from sqlite",
    });
    expect(data).toBe("from sqlite");
  });

  it("still runs local (SQLite) mutations while offline", async () => {
    client = createAppQueryClient(jest.fn());
    onlineManager.setOnline(false);
    const mutationFn = jest.fn(async () => "saved");
    const observer = client
      .getMutationCache()
      .build(client, { mutationFn, gcTime: 0 });
    await expect(observer.execute(undefined)).resolves.toBe("saved");
  });

  it("reports query errors through the given reporter", async () => {
    const report = jest.fn();
    client = createAppQueryClient(report);
    await client
      .fetchQuery({
        queryKey: ["boom"],
        queryFn: async () => {
          throw new Error("boom");
        },
        retry: false,
      })
      .catch(() => {});
    expect(report).toHaveBeenCalledWith(expect.any(Error));
  });
});
