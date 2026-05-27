import {
  useBodyMeasurementSessionsQuery,
  useBodyMeasurementChartQuery,
} from "../useBodyMeasurementSessionsQuery";
import {
  fetchBodyMeasurementSessions,
  fetchBodyMeasurementSessionsForChart,
} from "@/utils/database";
import { useQuery } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  fetchBodyMeasurementSessions: jest.fn(),
  fetchBodyMeasurementSessionsForChart: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

const OPTIONS = { weightUnit: "kg" as const, sizeUnit: "cm" as const };

describe("useBodyMeasurementSessionsQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls useQuery with correct queryKey including units", () => {
    useBodyMeasurementSessionsQuery(OPTIONS);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["bodyMeasurements", "sessions", "kg", "cm", "all"],
      }),
    );
  });

  it("includes limit in queryKey when provided", () => {
    useBodyMeasurementSessionsQuery(OPTIONS, 10);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["bodyMeasurements", "sessions", "kg", "cm", 10],
      }),
    );
  });

  it("queryFn calls fetchBodyMeasurementSessions with options and limit", async () => {
    const sessions = [
      { entry: { id: 1, recorded_at: "2026-01-01" }, values: [] },
    ];
    (fetchBodyMeasurementSessions as jest.Mock).mockResolvedValue(sessions);

    useBodyMeasurementSessionsQuery(OPTIONS, 5);

    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(fetchBodyMeasurementSessions).toHaveBeenCalledWith(OPTIONS, 5);
    expect(result).toEqual(sessions);
  });
});

describe("useBodyMeasurementChartQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls useQuery with correct queryKey", () => {
    useBodyMeasurementChartQuery(3, OPTIONS);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["bodyMeasurements", "chart", 3, "kg", "cm"],
      }),
    );
  });

  it("is disabled when metricId is 0", () => {
    useBodyMeasurementChartQuery(0, OPTIONS);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it("is enabled when metricId is > 0", () => {
    useBodyMeasurementChartQuery(2, OPTIONS);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    );
  });

  it("queryFn calls fetchBodyMeasurementSessionsForChart", async () => {
    const chartData = [{ recorded_at: "2026-01-01", displayValue: 75 }];
    (fetchBodyMeasurementSessionsForChart as jest.Mock).mockResolvedValue(
      chartData,
    );

    useBodyMeasurementChartQuery(3, OPTIONS);

    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(fetchBodyMeasurementSessionsForChart).toHaveBeenCalledWith(
      3,
      OPTIONS,
    );
    expect(result).toEqual(chartData);
  });
});
