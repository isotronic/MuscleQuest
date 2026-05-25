import { useQuery } from "@tanstack/react-query";
import {
  fetchBodyMeasurementSessions,
  fetchBodyMeasurementSessionsForChart,
  MeasurementDisplayOptions,
} from "@/utils/database";

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
