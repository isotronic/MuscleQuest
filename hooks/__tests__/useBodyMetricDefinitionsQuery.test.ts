import {
  useActiveBodyMetricDefinitionsQuery,
  useAllBodyMetricDefinitionsQuery,
} from "../useBodyMetricDefinitionsQuery";
import {
  fetchActiveBodyMetricDefinitions,
  fetchAllBodyMetricDefinitions,
} from "@/utils/database";
import { useQuery } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  fetchActiveBodyMetricDefinitions: jest.fn(),
  fetchAllBodyMetricDefinitions: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

describe("useActiveBodyMetricDefinitionsQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls useQuery with queryKey ['bodyMetricDefinitions', 'active']", () => {
    useActiveBodyMetricDefinitionsQuery();

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["bodyMetricDefinitions", "active"],
        queryFn: fetchActiveBodyMetricDefinitions,
      }),
    );
  });

  it("queryFn returns metric definitions", async () => {
    const metrics = [{ id: 1, key: "weight", label: "Body Weight" }];
    (fetchActiveBodyMetricDefinitions as jest.Mock).mockResolvedValue(metrics);

    useActiveBodyMetricDefinitionsQuery();

    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toEqual(metrics);
  });
});

describe("useAllBodyMetricDefinitionsQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls useQuery with queryKey ['bodyMetricDefinitions', 'all']", () => {
    useAllBodyMetricDefinitionsQuery();

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["bodyMetricDefinitions", "all"],
        queryFn: fetchAllBodyMetricDefinitions,
      }),
    );
  });

  it("queryFn returns all metric definitions including inactive", async () => {
    const metrics = [
      { id: 1, key: "weight", is_active: true },
      { id: 2, key: "height", is_active: false },
    ];
    (fetchAllBodyMetricDefinitions as jest.Mock).mockResolvedValue(metrics);

    useAllBodyMetricDefinitionsQuery();

    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toHaveLength(2);
    expect(result[1].is_active).toBe(false);
  });
});
