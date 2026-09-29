import { useQuery } from "@tanstack/react-query";
import {
  fetchBodyMeasurementSessions,
  fetchBodyMeasurementSessionsForChart,
  fetchLatestBodyMetricValues,
} from "@/utils/database";
import { type MeasurementDisplayOptions } from "@/utils/measurementConversions";
import { usePendingDeleteStore } from "@/store/pendingDeleteStore";

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
    queryFn: async () => {
      // Entries waiting out their Undo window are hidden, not yet deleted.
      // Fetch enough extra rows that hiding them still fills the limit.
      const hidden = usePendingDeleteStore.getState().measurementEntryIds;
      if (hidden.length === 0) {
        return fetchBodyMeasurementSessions(options, limit);
      }
      const sessions = await fetchBodyMeasurementSessions(
        options,
        limit === undefined ? undefined : limit + hidden.length,
      );
      const visible = sessions.filter((s) => !hidden.includes(s.entry.id));
      return limit === undefined ? visible : visible.slice(0, limit);
    },
    // Invalidated by the body-measurement mutations.
    staleTime: 60_000,
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
    // Invalidated by the body-measurement mutations.
    staleTime: 60_000,
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
    // Invalidated by the body-measurement mutations.
    staleTime: 60_000,
  });
};
