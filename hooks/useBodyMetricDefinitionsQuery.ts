import { useQuery } from "@tanstack/react-query";
import {
  fetchActiveBodyMetricDefinitions,
  fetchAllBodyMetricDefinitions,
} from "@/utils/database";

export const useActiveBodyMetricDefinitionsQuery = () => {
  return useQuery({
    queryKey: ["bodyMetricDefinitions", "active"],
    queryFn: fetchActiveBodyMetricDefinitions,
    staleTime: 5 * 60 * 1000,
  });
};

export const useAllBodyMetricDefinitionsQuery = () => {
  return useQuery({
    queryKey: ["bodyMetricDefinitions", "all"],
    queryFn: fetchAllBodyMetricDefinitions,
    staleTime: 5 * 60 * 1000,
  });
};
