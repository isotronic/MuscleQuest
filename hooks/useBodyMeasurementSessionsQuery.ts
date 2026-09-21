import { useQuery } from "@tanstack/react-query";
import {
  fetchBodyMeasurementSessions,
  fetchBodyMeasurementSessionsForChart,
  fetchLatestBodyMetricValues,
} from "@/utils/database";
import { type MeasurementDisplayOptions } from "@/utils/measurementConversions";

export const useBodyMeasurementSessionsQuery = (
  options: MeasurementDisplayOptions,
  limit?: number,
) => {
  return useQuery({
    queryKey: [
      "bodyMeasurements",
      "sessions",
      options.weightUnit,
      options.sizeUnit,
      limit ?? "all",
    ],
    queryFn: () => fetchBodyMeasurementSessions(options, limit),
    staleTime: 0,
    gcTime: 0,
  });
};

/** Latest reading per metric, for the home-screen card and its log sheet. */
export const useLatestBodyMetricValuesQuery = (
  options: MeasurementDisplayOptions,
) => {
  return useQuery({
    queryKey: [
      "bodyMeasurements",
      "latestPerMetric",
      options.weightUnit,
      options.sizeUnit,
    ],
    queryFn: () => fetchLatestBodyMetricValues(options),
    staleTime: 0,
    gcTime: 0,
  });
};

export const useBodyMeasurementChartQuery = (
  metricId: number,
  options: MeasurementDisplayOptions,
) => {
  return useQuery({
    queryKey: [
      "bodyMeasurements",
      "chart",
      metricId,
      options.weightUnit,
      options.sizeUnit,
    ],
    queryFn: () => fetchBodyMeasurementSessionsForChart(metricId, options),
    enabled: metricId > 0,
    staleTime: 0,
    gcTime: 0,
  });
};
